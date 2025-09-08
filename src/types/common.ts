export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
};