export function createTimestampButton(onClick: () => void): HTMLElement {
  const button = document.createElement("button");
  button.textContent = "Add Timestamp";
  button.classList.add("yt-timestamp-btn");
  button.addEventListener("click", onClick);
  return button;
}