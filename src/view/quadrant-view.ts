// src/ui/quadrant-view.ts
import { App } from "obsidian";

export class QuadrantLayout {
  container: HTMLElement;

  constructor(app: App, videoUrl: string) {
    this.container = createDiv({ cls: "quadrant-container" });

    // Quadrant I – fixed YouTube video (top-right)
    const q1 = createDiv({ cls: "quadrant q1" });
    q1.innerHTML = `
      <iframe
        width="100%"
        height="100%"
        src="${videoUrl}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;
    this.container.appendChild(q1);

    // Quadrant II – top-left scrollable notes
    const q2 = createDiv({ cls: "quadrant q2" });
    q2.innerHTML = `<div class="notes-pane">Quadrant II – Notes</div>`;
    this.container.appendChild(q2);

    // Quadrant III – bottom-left
    const q3 = createDiv({ cls: "quadrant q3" });
    q3.innerHTML = `<div class="notes-pane">Quadrant III – Notes</div>`;
    this.container.appendChild(q3);

    // Quadrant IV – bottom-right
    const q4 = createDiv({ cls: "quadrant q4" });
    q4.innerHTML = `<div class="notes-pane">Quadrant IV – Notes</div>`;
    this.container.appendChild(q4);
  }

  getElement(): HTMLElement {
    return this.container;
  }
}