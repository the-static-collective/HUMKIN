import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {runInNewContext} from "node:vm";

const root = new URL("../", import.meta.url);
const read = name => readFileSync(new URL(name, root), "utf8");
const page = read("season/index.html");
const script = read("season/season.js");

function stub() {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  return {
    dataset: {},
    style: {},
    children: [],
    hidden: false,
    focused: false,
    textContent: "",
    classList: {
      toggle(name) {
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      },
      remove: name => classes.delete(name)
    },
    append(...items) {
      this.children.push(...items);
      for (const item of items) item.parent = this;
    },
    remove() {
      this.parent.children = this.parent.children.filter(item => item !== this);
    },
    get firstElementChild() { return this.children[0]; },
    setAttribute(key, value) { attributes.set(key, value); },
    getAttribute(key) { return attributes.get(key); },
    addEventListener(name, callback) { listeners.set(name, callback); },
    emit(name, props = {}) { listeners.get(name)?.({button: 0, currentTarget: this, ...props}); },
    focus() { this.focused = true; },
    scrollIntoView() {}
  };
}

function fixture(reducedMotion = false) {
  const elements = new Map([...page.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, stub()]));
  const hero = stub();
  const tune = elements.get("station-tune");
  const preference = stub();
  const location = "https://preview.example/season/";
  for (const anchor of [hero, tune]) {
    Object.defineProperty(anchor, "href", {
      get() { return new URL(anchor.getAttribute("href") ?? "../fm/#receiver", location).href; }
    });
  }
  elements.get("listening-room").hidden = true;
  preference.matches = reducedMotion;
  runInNewContext(script, {
    URL,
    matchMedia: () => preference,
    document: {
      createElement: () => stub(),
      getElementById: id => elements.get(id),
      querySelectorAll: () => [hero, tune]
    }
  });

  return {elements, hero, tune, preference, get: id => elements.get(id)};
}

test("the dial exposes ten choices and distinguishes unprogrammed formats", () => {
  const {get, tune} = fixture();
  const [{getAttribute}, top40] = get("stations").children;
  assert.equal(get("stations").children.length, 10);
  assert.equal(getAttribute("aria-pressed"), "true");
  assert.equal(get("station-status").textContent, "Receiver available");
  assert.equal(tune.hidden, false);
  top40.emit("click");
  assert.equal(get("station-status").textContent, "In development");
  assert.equal(get("station-name").textContent, "Top 40");
  assert.equal(tune.hidden, true);
  assert.equal(get("receiver-mount").children.length, 0);
});

test("the classic receiver opens on demand and stays mounted while browsing", () => {
  const {get, hero} = fixture();
  const open = {preventDefault() {}};
  hero.emit("click", {metaKey: true});
  assert.equal(get("receiver-mount").children.length, 0);
  hero.emit("click", open);
  const [frame] = get("receiver-mount").children;
  assert.equal(frame.src, "https://preview.example/fm/#receiver");
  assert.equal(get("listening-room").hidden, false);
  assert.equal(get("receiver-title").focused, true);
  get("stations").children[7].emit("click");
  assert.equal(get("receiver-mount").firstElementChild, frame);
  hero.emit("click", open);
  assert.equal(get("receiver-mount").children.length, 1);
  get("close-receiver").emit("click");
  assert.equal(get("receiver-mount").children.length, 0);
  assert.equal(get("listening-room").hidden, true);
  assert.equal(hero.focused, true);
});

test("motion is voluntary and reduced motion stops it", () => {
  const {get, preference} = fixture();
  const motion = get("motion");
  assert.equal(motion.textContent, "Start the visualizer");
  motion.emit("click");
  assert.equal(motion.textContent, "Pause the visualizer");
  preference.matches = true;
  preference.emit("change");
  assert.equal(motion.hidden, true);
  assert.equal(motion.textContent, "Start the visualizer");
});

test("the compact player opt-in is present alongside the classic controls", () => {
  const receiver = read("fm/index.html");
  for (const id of ["receiver", "listen", "mode-shuffle", "spotlight", "current-art", "current-title"]) {
    assert.ok(receiver.includes('id="' + id + '"'), id);
  }
  assert.match(receiver, /network-receiver\.css/);
  assert.match(read("fm/network-receiver.css"), /#receiver:target/);
});
