/* @refresh reload */
import { render } from "solid-js/web";
import { RoguelikeApp } from "./RoguelikeApp";
import "./style.css";
import "./pve-style.css";

const root = document.getElementById("root");
if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to index.html?",
  );
}

root!.innerHTML = "";
render(() => <RoguelikeApp />, root!);
