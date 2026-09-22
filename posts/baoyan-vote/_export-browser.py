# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = ["catboost==1.2.10", "numpy>=2,<3", "pandas>=2.2,<3"]
# ///
"""Export the frozen model for Pyodide; never train, clean, or publish row data.

Run with the source project's environment (or `uv run` using this script's metadata):
    uv run posts/baoyan-vote/_export-browser.py --source /path/to/baoyan-vote
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

import catboost
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier, Pool

ARTICLE = Path(__file__).resolve().parent

INFERENCE = '''"""Pure-Python inference of the frozen CatBoost model; no network or native libraries."""
import json
import math
import struct
from pathlib import Path
from . import exported_model
from .features import transform, validate_background

SPEC = json.loads((Path(__file__).parent / "feature-spec.json").read_text())
# CatBoost's Python export spells UTF-8 bytes as \\xNN literals. Decode those
# keys back to Unicode so Chinese categories keep the native model's hashes.
exported_model.cat_features_hashes = {
    key.encode("latin1").decode("utf-8"): value
    for key, value in exported_model.cat_features_hashes.items()
}
NUMERIC = [key for key in SPEC["columns"] if key not in SPEC["categorical"]]
CLASSES = ["不行", "刚好", "OQ"]


def predict_features(features):
    # Native CatBoost quantizes float32 inputs. Match its boundary behavior.
    floats = [struct.unpack("f", struct.pack("f", features[key]))[0] for key in NUMERIC]
    cats = [features[key] for key in SPEC["categorical"]]
    logits = exported_model.apply_catboost_model_multi(floats, cats)
    weights = [math.exp(value - max(logits)) for value in logits]
    return [value / sum(weights) for value in weights]


def predict(background):
    errors = validate_background(background)
    if errors:
        raise ValueError("；".join(errors))
    probabilities = predict_features(transform(background))
    return {"probabilities": dict(zip(CLASSES, probabilities)),
            "prediction": CLASSES[max(range(3), key=probabilities.__getitem__)]}
'''


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    model_dir = source / "artifacts/model"
    spec_bytes = (model_dir / "feature-spec.json").read_bytes()
    spec = json.loads(spec_bytes)
    if spec["version"] != "mvp-10-quantities-only":
        raise ValueError("Unexpected model version; update the article and parity protocol first")
    model = CatBoostClassifier()
    model.load_model(str(model_dir / "community.cbm"))
    assert list(model.classes_) == [0, 1, 2]
    assert model.get_all_params()["nan_mode"] == "Min"
    assert model.feature_names_ == spec["columns"]
    table = pd.read_csv(model_dir / "feature-table.csv")
    features = table[spec["columns"]]
    assert len(features) == 1379
    files = {}
    for name in ["__init__.py", "features.py", "schema.py", "preferences.py", "ui.py"]:
        data = (source / "baoyan" / name).read_bytes()
        if name in spec["implementation_sha256"]:
            assert sha256(data) == spec["implementation_sha256"][name], name
        files[f"baoyan_browser/{name}"] = data
    with tempfile.TemporaryDirectory() as directory:
        directory = Path(directory)
        exported = directory / "exported_model.py"
        model.save_model(str(exported), format="python", pool=Pool(
            features.loc[table["split"] == "train"], cat_features=spec["categorical"]))
        files["baoyan_browser/exported_model.py"] = exported.read_bytes()
        files["baoyan_browser/feature-spec.json"] = spec_bytes
        files["baoyan_browser/inference.py"] = INFERENCE.encode()
        for name, data in files.items():
            path = directory / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        sys.path.insert(0, str(directory))
        from baoyan_browser.features import transform
        from baoyan_browser.inference import predict_features
        from baoyan_browser.schema import TIERS
        portable = np.array([predict_features(row) for row in features.to_dict("records")])
        native = model.predict_proba(features)
        max_error = float(np.max(np.abs(portable - native)))
        assert max_error < 1e-12, max_error
        # Synthetic inputs cover missing values, all school/target categories,
        # English categories, future plans and unknown achievement quantities.
        synthetic = []
        for school in ["unknown", *TIERS]:
            for target in TIERS:
                for english in ["unknown", "四级", "六级", "雅思", "托福"]:
                    synthetic.append(transform({"school_tier": school,
                        "english_type": english, "target": {"tiers": [target]}}))
        for quantity in [None, 1, 3, 4, 100]:
            for progress in ["planned", "ongoing", "submitted", "accepted"]:
                synthetic.append(transform({"rank": 5, "total_students": 100,
                    "target": {"tiers": ["中九", "华五"]}, "research_state": "present",
                    "research": [{"kind": "paper", "quantity": quantity,
                                  "author": "first", "progress": progress}]}))
        synthetic_native = model.predict_proba(pd.DataFrame(synthetic)[spec["columns"]])
        synthetic_portable = np.array([predict_features(row) for row in synthetic])
        synthetic_error = float(np.max(np.abs(synthetic_native - synthetic_portable)))
        assert synthetic_error < 1e-12, synthetic_error
    # Re-aggregate vote totals only from the exact snapshot documented by the article.
    aggregate_path = ARTICLE / "aggregate-data.json"
    aggregate = json.loads(aggregate_path.read_text())
    raw_bytes = (source / "data/submissions.json").read_bytes()
    assert sha256(raw_bytes) == aggregate["source_sha256"]["data/submissions.json"]
    records = json.loads(raw_bytes)
    totals = [row["votes"]["total"] for row in records]
    assert all(type(total) is int and total >= 0 for total in totals)
    assert len(totals) == aggregate["raw_records"]
    assert sum(totals) == sum(aggregate["vote_counts"])
    assert sum(total > 0 for total in totals) == aggregate["records_with_votes"]
    step = 10
    bins = [{"label": "0", "start": 0, "end": 0}]
    bins += [{"label": f"{start}–{start + step - 1}", "start": start, "end": start + step - 1}
             for start in range(1, 201, step)]
    bins += [{"label": ">200", "start": 201, "end": None}]
    classes = aggregate["classes"]
    for row in bins:
        row["count"] = 0
        row["mean_shares"] = {label: 0.0 for label in classes}
    for record, total in zip(records, totals):
        assert sum(record["votes"][label] for label in classes) == total
        index = 0 if total == 0 else min((total - 1) // step + 1, 21)
        row = bins[index]
        row["count"] += 1
        if total:
            for label in classes:
                row["mean_shares"][label] += record["votes"][label] / total
    for row in bins:
        row["mean_shares"] = {
            label: value / row["count"] if row["count"] and row["start"] > 0 else None
            for label, value in row["mean_shares"].items()
        }
    aggregate["vote_count_histogram"] = {
        "bin_width": step, "interval": "inclusive integer bounds; zero separate; >200 open tail",
        "share_weight": "submission_equal", "zero_vote_records": totals.count(0),
        "max_votes": max(totals), "bins": bins,
    }
    predictions_path = model_dir / "held-out-predictions.json"
    predictions_bytes = predictions_path.read_bytes()
    predictions = json.loads(predictions_bytes)
    evaluation = aggregate["current_model_evaluation"]
    assert sha256((model_dir / "evaluation.json").read_bytes()) == aggregate["source_sha256"]["artifacts/model/evaluation.json"]
    assert len(predictions) == evaluation["held_out_records"]
    counts = [[0 for _ in classes] for _ in classes]
    excluded_ties = 0
    for record in predictions:
        votes = [record["votes"][label] for label in classes]
        winners = [i for i, value in enumerate(votes) if value == max(votes)]
        assert record["tied_actual_majority"] == (len(winners) > 1)
        predicted = max(range(len(classes)), key=record["probabilities"].__getitem__)
        assert record["prediction"] == classes[predicted]
        if len(winners) > 1:
            excluded_ties += 1
        else:
            counts[winners[0]][predicted] += 1
    assert excluded_ties == evaluation["catboost"]["tied_majority_records"] == 3
    assert sum(map(sum, counts)) == evaluation["catboost"]["unique_majority_records"] == 135
    assert sum(counts[i][i] for i in range(3)) == 104
    assert {label: sum(row["prediction"] == label for row in predictions) for label in classes} == evaluation["prediction_counts"]
    evaluation["confusion_matrix"] = {"classes": classes, "counts": counts,
                                      "records": 135, "excluded_ties": excluded_ties}
    aggregate["source_sha256"]["artifacts/model/held-out-predictions.json"] = sha256(predictions_bytes)
    aggregate_path.write_text(json.dumps(aggregate, ensure_ascii=False, indent=2) + "\n")
    # Only aggregate data and categorical/model parameters enter the archive.
    for name in ["aggregate-data.json", "school-target-flows.csv"]:
        files[name] = (ARTICLE / name).read_bytes()
    manifest = {
        "model_version": spec["version"], "catboost_export_version": catboost.__version__,
        "source_commit": subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip(),
        "source_model_sha256": sha256((model_dir / "community.cbm").read_bytes()),
        "source_feature_table_sha256": sha256((model_dir / "feature-table.csv").read_bytes()),
        "parity": {"eligible_rows": len(features), "max_absolute_probability_error": max_error,
                   "synthetic_rows": len(synthetic), "synthetic_max_error": synthetic_error,
                   "tolerance": 1e-12},
        "notes": ["No training or semantic API calls; exact frozen model export.",
                  "Unicode hash keys decoded from CatBoost byte literals; float32 input conversion.",
                  "No individual submissions, feature rows, votes, authentication or API keys included.",
                  "Commit alone does not identify locally modified artifacts; hashes bind the snapshot."],
        "files_sha256": {name: sha256(data) for name, data in sorted(files.items())},
    }
    output = ARTICLE / "public"
    output.mkdir(exist_ok=True)
    with zipfile.ZipFile(output / "browser-bundle.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 21, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    manifest["bundle_sha256"] = sha256((output / "browser-bundle.zip").read_bytes())
    (output / "browser-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(manifest["parity"], indent=2))
    print(f"Bundle: {(output / 'browser-bundle.zip').stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
