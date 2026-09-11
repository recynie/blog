"""Run after quarto render: uv run scripts/verify.py."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
posts = sorted((ROOT / "posts").glob("*/index.qmd"))
assert posts, "No articles found"
post_outputs = {path.relative_to(ROOT).with_suffix(".html") for path in posts}
rendered_posts = {path.relative_to(SITE) for path in (SITE / "posts").glob("*/index.html")}
assert rendered_posts == post_outputs, (rendered_posts, post_outputs)
assert not (SITE / "drafts").exists()
assert not list(SITE.rglob("*.qmd"))
assert not (SITE / "scripts").exists()
search = json.loads((SITE / "search.json").read_text())
assert not any("drafts/" in item["href"] for item in search)
indexed = {item["href"].split("#")[0].lstrip("/") for item in search}
for post in posts:
    body = re.split(r"\A---\n.*?\n---(?:\n|$)", post.read_text(), maxsplit=1, flags=re.S)[1]
    if body.strip():
        output = post.relative_to(ROOT).with_suffix(".html").as_posix()
        assert output in indexed, output


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ("href", "src") and value:
                self.links.append(value)


broken = []
for page in SITE.rglob("*.html"):
    parser = Links()
    parser.feed(page.read_text())
    for link in parser.links:
        url = urlsplit(link)
        if url.scheme or url.netloc or not url.path:
            continue
        path = unquote(url.path)
        target = SITE / path.lstrip("/") if path.startswith("/") else page.parent / path
        if not target.exists():
            broken.append((str(page.relative_to(SITE)), link))
assert not broken, broken
print(f"PASS: {len(rendered_posts)} rendered posts; nonempty posts indexed; drafts and project sources excluded.")
print("All local links/assets resolve.")
