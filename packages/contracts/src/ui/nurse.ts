// NUR-* requirements support
import { UIState } from './core';

export interface NurseBoard {
  state: UIState;
  activeShift: boolean;
  agenda: Array<any>; // NUR-AGENDA
  assignedBeds: Array<string>;
}
