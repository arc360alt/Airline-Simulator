export interface Panel {
  id: string;
  title: string;
  short: string;
  icon: string;
  color: string;
  /** keyboard shortcut */
  key: string;
  render: () => HTMLElement;
}
