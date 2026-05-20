export interface NavItem {
  readonly id: string;
  readonly labelKey: string;
  readonly href?: string;
  readonly onClickAction?: "go-home" | "go-studio";
}
