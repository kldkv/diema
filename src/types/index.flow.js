// @flow

export type settings = {
  selector: string | HTMLElement,
  duration: number,
  easing: string,
  perPage: number | {
    [number | string]: number
  },
  startIndex: number,
  draggable: boolean,
  multipleDrag: boolean,
  threshold: number,
  loop: boolean,
  rtl: boolean,
  onInit: () => void,
  onChange: () => void,
}
