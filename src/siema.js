// @flow
import type {settings} from './types/index.flow'

class Siema {
  constructor(options: settings) {
    // Merge defaults with user's settings
    this.config = Siema._mergeSettings(options)
    const {selector, startIndex, loop} = this.config

    // Resolve selector's type
    if (typeof selector === 'string') {
      const element = document.querySelector(selector)

      if (element) {
        this.selector = element
      }
    } else if (selector instanceof HTMLElement) {
      this.selector = selector
    }

    // Early throw if selector doesn't exists
    if (this.selector == null) {
      throw new Error('Something wrong with your selector')
    }

    if (this.selector) {
      this.innerElements = [].slice.call(this.selector.children)

      const innerElementsLength = this.innerElements.length

      this._resolveSlidesNumber()

      this.selectorWidth = this.selector.offsetWidth
      this.currentSlide = loop
        ? startIndex % innerElementsLength
        : Math.max(0, Math.min(startIndex, innerElementsLength - this.perPage))

      this.transformProperty = Siema.webkitOrNot
    } else {
      throw new Error('Something wrong with your selector')
    }

    // Build markup and apply required styling to elements
    this._init()
  }

  config: $Exact<settings>
  selector: HTMLElement
  selectorWidth: number
  innerElements: Array<HTMLElement>
  currentSlide: number
  perPage: number
  transformProperty: string
  pointerDown: boolean
  drag: {
    startX: number,
    endX: number,
    startY: number,
    letItGo: ?boolean,
    preventClick: boolean,
  }
  sliderFrame: HTMLDivElement

  static _mergeSettings(options: settings): $Exact<settings> {
    const settings: $Exact<settings> = {
      selector: '.siema',
      duration: 200,
      easing: 'ease-out',
      perPage: 1,
      startIndex: 0,
      draggable: true,
      multipleDrag: true,
      threshold: 20,
      loop: false,
      rtl: false,
      onInit: () => {},
      onChange: () => {},
    }

    return Object.assign({}, settings, options)
  }

  /**
   * Determine if browser supports unprefixed transform property.
   * Google Chrome since version 26 supports prefix-less transform
   */
  static get webkitOrNot(): string {
    const style = document.documentElement && document.documentElement.style

    if (style && typeof style.transform === 'string') {
      return 'transform'
    }

    return '-webkit-transform'
  }

  static _setTransition(element: HTMLElement, transition: string): void {
    element.style.setProperty('-webkit-transition', transition)
    element.style.setProperty('transition', transition)
  }

  /**
   * Attaches listeners to required events.
   */
  _attachEvents(): void {
    // If element is draggable / swipable, add event handlers
    if (this.config.draggable) {
      // Keep track pointer hold and dragging distance
      this.pointerDown = false
      this.drag = {
        startX: 0,
        endX: 0,
        startY: 0,
        letItGo: null,
        preventClick: false,
      }

      // Resize element on window resize
      window.addEventListener('resize', this._resizeHandler)

      this._events('attach')
    }
  }

  /**
   * Detaches listeners from required events.
   */
  _detachEvents(): void {
    window.removeEventListener('resize', this._resizeHandler)

    this._events('detach')
  }

  _events(type: string): void {
    const selector = type === 'attach'
      ? this.selector.addEventListener
      : this.selector.removeEventListener;

    const events = {
      touchstart: this._touchstartHandler,
      touchend: this._touchendHandler,
      touchmove: this._touchmoveHandler,
      mousedown: this._mousedownHandler,
      mouseup: this._mouseupHandler,
      mouseleave: this._mouseleaveHandler,
      mousemove: this._mousemoveHandler,
      click: this._clickHandler
    };

    Object.entries(events).forEach(([event, handler]) => {
      selector(event, handler)
    })
  }

  _getDirection = (type: 'string' | 'number'): any => {
    const direction = this.config.rtl

    if (type === 'string') {
      return direction ? 'rtl' : 'ltr'
    }

    if (type === 'number') {
      return direction ? 1 : -1
    }
  }

  _getStatusIgnoreElements = (target: string): boolean => {
    return ['TEXTAREA', 'OPTION', 'INPUT', 'SELECT'].indexOf(target) !== -1;
  }

  /**
   * Builds the markup and attaches listeners to required events.
   */
  _init(): void {
    this._attachEvents()

    // hide everything out of selector's boundaries
    this.selector.style.setProperty('overflow', 'hidden')

    // rtl or ltr
    this.selector.style.setProperty('direction', this._getDirection('string'))

    // build a frame and slide to a currentSlide
    this._buildSliderFrame()

    this.config.onInit.call(this)
  }

  /**
   * Build a sliderFrame and slide to a current item.
   */
  _buildSliderFrameItem(elm: HTMLElement): HTMLDivElement {
    const elementContainer = document.createElement('div')
    const innerElementsLength = this.innerElements.length
    const floatDirection = this.config.rtl
      ? 'right'
      : 'left'
    const width = this.config.loop
      ? 100 / (innerElementsLength + this.perPage * 2)
      : 100 / innerElementsLength;


    elementContainer.style.setProperty('float', floatDirection)
    elementContainer.style.setProperty('width', `${width}%`)

    elementContainer.appendChild(elm)

    return elementContainer
  }

  /**
   * Moves sliders frame to position of currently active slide
   */
  _slideToCurrent(enableTransition?: boolean): void {
    const currentSlide = this.config.loop
      ? this.currentSlide + this.perPage
      : this.currentSlide

    const offset = this._getDirection('number') * currentSlide * (this.selectorWidth / this.perPage)

    const translate = `translate3d(${offset}px, 0, 0)`

    if (enableTransition) {
      // This one is tricky, I know but this is a perfect explanation:
      // https://youtu.be/cCOL7MC4Pl0
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this._enableTransition()
          this.sliderFrame.style.setProperty(this.transformProperty, translate)
        })
      })
    } else {
      this.sliderFrame.style.setProperty(this.transformProperty, translate)
    }
  }

  /**
   * Recalculate drag /swipe event and reposition the frame of a slider
   */
  _updateAfterDrag(): void {
    const movement = (this.config.rtl ? -1 : 1) * (this.drag.endX - this.drag.startX)
    const movementDistance = Math.abs(movement)
    const howManySliderToSlide = this.config.multipleDrag
      ? Math.ceil(movementDistance / (this.selectorWidth / this.perPage))
      : 1

    const slideToNegativeClone = movement > 0 && this.currentSlide - howManySliderToSlide < 0
    const slideToPositiveClone =
      movement < 0 &&
      this.currentSlide + howManySliderToSlide > this.innerElements.length - this.perPage

    if (
      movement > 0 &&
      movementDistance > this.config.threshold &&
      this.innerElements.length > this.perPage
    ) {
      this.prev(howManySliderToSlide)
    } else if (
      movement < 0 &&
      movementDistance > this.config.threshold &&
      this.innerElements.length > this.perPage
    ) {
      this.next(howManySliderToSlide)
    }
    this._slideToCurrent(slideToNegativeClone || slideToPositiveClone)
  }

  /**
   * Build a sliderFrame and slide to a current item.
   */
  _buildSliderFrame(): void {
    const widthItem = this.selectorWidth / this.perPage
    const innerElementsLength = this.innerElements.length
    const itemsToBuild = this.config.loop
      ? innerElementsLength + 2 * this.perPage
      : innerElementsLength

    // Create frame and apply styling
    this.sliderFrame = document.createElement('div')
    this.sliderFrame.style.width = `${widthItem * itemsToBuild}px`
    this._enableTransition()

    if (this.config.draggable) {
      this.selector.style.cursor = '-webkit-grab'
    }

    // Create a document fragment to put slides into it
    const docFragment = document.createDocumentFragment()

    // Loop through the slides, add styling and add them to document fragment
    if (this.config.loop) {
      const amountPrependSlides = innerElementsLength - this.perPage

      this.innerElements.forEach((item, index) => {
        if (amountPrependSlides <= index) {
          docFragment.appendChild(this._buildSliderFrameItem(item.cloneNode(true)))
        }
      })
    }

    this.innerElements.forEach((item) => {
      docFragment.appendChild(this._buildSliderFrameItem(item))
    });

    if (this.config.loop) {
      const amountAppendSlides = this.perPage

      this.innerElements.forEach((item, index) => {
        if (amountAppendSlides > index) {
          docFragment.appendChild(this._buildSliderFrameItem(item.cloneNode(true)))
        }
      })
    }

    // Add fragment to the frame
    this.sliderFrame.appendChild(docFragment)

    // Clear selector (just in case something is there) and insert a frame
    this.selector.innerHTML = ''
    this.selector.appendChild(this.sliderFrame)

    // Go to currently active slide after initial build
    this._slideToCurrent()
  }

  /**
   * Determinates slides number accordingly to clients viewport.
   */
  _resolveSlidesNumber(): void {
    const {perPage} = this.config
    const {innerWidth} = window

    if (typeof perPage === 'number') {
      this.perPage = perPage
    } else {
      this.perPage = 1

      Object.keys(perPage).forEach((viewport) => {
        if (innerWidth >= viewport) {
          this.perPage = perPage[viewport]
        }
      })
    }
  }

  /**
   * Go to next or prev slide.
   */
  _changeSlide(type: 'next' | 'prev', howManySlides: number, callback?: () => void): void {
    const isNext = type === 'next';
    const {loop, draggable} = this.config;
    const innerElementsLength = this.innerElements.length


    if (innerElementsLength <= this.perPage) {
      return
    }

    const beforeChange = this.currentSlide

    if (loop) {
      const isNewIndexClone = isNext
        ? this.currentSlide + howManySlides > innerElementsLength - this.perPage
        : this.currentSlide - howManySlides < 0

      if (isNewIndexClone) {
        this._disableTransition()

        const mirrorSlideIndex = isNext
          ? this.currentSlide - innerElementsLength
          : this.currentSlide + innerElementsLength

        const mirrorSlideIndexOffset = this.perPage
        const moveTo = mirrorSlideIndex + mirrorSlideIndexOffset
        const offset = this._getDirection('number') * moveTo * (this.selectorWidth / this.perPage)
        const dragDistance = draggable
          ? this.drag.endX - this.drag.startX
          : 0

        this.sliderFrame.style.setProperty(
          this.transformProperty,
          `translate3d(${offset + dragDistance}px, 0, 0)`
        )

        this.currentSlide = isNext
          ? mirrorSlideIndex + howManySlides
          : mirrorSlideIndex - howManySlides
      } else {
        this.currentSlide = isNext
          ? this.currentSlide + howManySlides
          : this.currentSlide - howManySlides
      }
    } else {
      this.currentSlide = isNext
        ? Math.min(this.currentSlide + howManySlides, innerElementsLength - this.perPage)
        : Math.max(this.currentSlide - howManySlides, 0)
    }

    if (beforeChange !== this.currentSlide) {
      this._slideToCurrent(loop)
      this.config.onChange.call(this)

      callback && callback.call(this)
    }
  }

  /**
   * Disable transition on sliderFrame.
   */
  _disableTransition(): void {
    const transition = `all 0ms ${this.config.easing}`

    Siema._setTransition(this.sliderFrame, transition)
  }

  /**
   * Enable transition on sliderFrame.
   */
  _enableTransition(): void {
    Siema._setTransition(this.sliderFrame, `all ${this.config.duration}ms ${this.config.easing}`)
  }

  /**
   * Clear drag after touchend and mouseup event
   */
  _clearDrag(): void {
    this.drag = {
      startX: 0,
      endX: 0,
      startY: 0,
      letItGo: null,
      preventClick: this.drag.preventClick,
    }
  }

  /**
   * When window resizes, resize slider components as well
   */
  _resizeHandler = (): void => {
    const innerElementsLength = this.innerElements.length
    // update perPage number dependable of user value
    this._resolveSlidesNumber()

    // relcalculate currentSlide
    // prevent hiding items when browser width increases
    if (this.currentSlide + this.perPage > innerElementsLength) {
      this.currentSlide =
        innerElementsLength <= this.perPage
          ? 0
          : innerElementsLength - this.perPage
    }

    this.selectorWidth = this.selector.offsetWidth

    this._buildSliderFrame()
  }

  /**
   * touchstart event handler
   */
  _touchstartHandler = (e: TouchEvent): void => {
    if (e.target instanceof Element) {
      // Prevent dragging / swiping on inputs, selects and textareas
      if (this._getStatusIgnoreElements(e.target.nodeName)) {
        return
      }

      e.stopPropagation()

      this.pointerDown = true
      this.drag.startX = e.touches[0].pageX
      this.drag.startY = e.touches[0].pageY
    }
  }

  /**
   * touchend event handler
   */
  _touchendHandler = (e: TouchEvent): void => {
    e.stopPropagation()
    this.pointerDown = false
    this._enableTransition()

    if (this.drag.endX) {
      this._updateAfterDrag()
    }

    this._clearDrag()
  }

  /**
   * touchmove event handler
   */
  _touchmoveHandler = (e: TouchEvent): void => {
    e.stopPropagation()

    if (this.drag.letItGo == null) {
      this.drag.letItGo =
        Math.abs(this.drag.startY - e.touches[0].pageY) <
        Math.abs(this.drag.startX - e.touches[0].pageX)
    }

    if (this.pointerDown && this.drag.letItGo) {
      const {loop, rtl, easing} = this.config
      const transition = `all 0ms ${easing}`

      e.preventDefault()
      this.drag.endX = e.touches[0].pageX
      Siema._setTransition(this.sliderFrame, transition)

      const currentSlide = loop
        ? this.currentSlide + this.perPage
        : this.currentSlide

      const currentOffset = currentSlide * (this.selectorWidth / this.perPage)
      const dragOffset = this.drag.endX - this.drag.startX
      const offset = rtl
        ? currentOffset + dragOffset
        : currentOffset - dragOffset

      this.sliderFrame.style.setProperty(
        this.transformProperty,
        `translate3d(${this._getDirection('number') * offset}px, 0, 0)`
      )
    }
  }

  /**
   * mousedown event handler
   */
  _mousedownHandler = (e: MouseEvent): void => {
    // Prevent dragging / swiping on inputs, selects and textareas
    if (e.target instanceof Element) {
      if (this._getStatusIgnoreElements(e.target.nodeName)) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      this.pointerDown = true
      this.drag.startX = e.pageX
    }
  }

  /**
   * mouseup event handler
   */
  _mouseupHandler = (e: MouseEvent): void => {
    e.stopPropagation()

    this.pointerDown = false
    this.selector.style.cursor = '-webkit-grab'
    this._enableTransition()

    if (this.drag.endX) {
      this._updateAfterDrag()
    }

    this._clearDrag()
  }

  /**
   * mousemove event handler
   */
  _mousemoveHandler = (e: MouseEvent): void => {
    e.preventDefault()

    if (this.pointerDown) {
      // if dragged element is a link
      // mark preventClick prop as a true
      // to detemine about browser redirection later on

      if (e.target instanceof Element && e.target.nodeName === 'A' && this.pointerDown) {
        this.drag.preventClick = true
      }

      const transition = `all 0ms ${this.config.easing}`

      this.drag.endX = e.pageX
      this.selector.style.setProperty('cursor','-webkit-grabbing')
      Siema._setTransition(this.sliderFrame, transition)

      const currentSlide = this.config.loop
        ? this.currentSlide + this.perPage
        : this.currentSlide
      const currentOffset = currentSlide * (this.selectorWidth / this.perPage)
      const dragOffset = this.drag.endX - this.drag.startX
      const offset = this.config.rtl
        ? currentOffset + dragOffset
        : currentOffset - dragOffset

      this.sliderFrame.style.setProperty(
        this.transformProperty,
        `translate3d(${this._getDirection('number') * offset}px, 0, 0)`
      )
    }
  }

  /**
   * mouseleave event handler
   */
  _mouseleaveHandler = (e: MouseEvent): void => {
    if (this.pointerDown) {
      this.pointerDown = false
      this.selector.style.cursor = '-webkit-grab'
      this.drag.endX = e.pageX
      this.drag.preventClick = false
      this._enableTransition()
      this._updateAfterDrag()
      this._clearDrag()
    }
  }

  /**
   * click event handler
   */
  _clickHandler = (e: MouseEvent): void => {
    // if the dragged element is a link
    // prevent browsers from folowing the link
    if (this.drag.preventClick) {
      e.preventDefault()
    }

    this.drag.preventClick = false
  }

  /**
   * Remove item from carousel.
   */
  remove(index: number, callback?: () => void) {
    if ((index < 0) || (index >= this.innerElements.length)) {
      throw new Error("Item to remove doesn't exist")
    }

    // Shift sliderFrame back by one item when:
    // 1. Item with lower index than currenSlide is removed.
    // 2. Last item is removed.
    const lowerIndex = index < this.currentSlide
    const lastItem = this.currentSlide + this.perPage - 1 === index

    if (lowerIndex || lastItem) {
      this.currentSlide--
    }

    this.innerElements.splice(index, 1)

    // build a frame and slide to a currentSlide
    this._buildSliderFrame()

    callback && callback.call(this)
  }

  /**
   * Insert item to carousel at particular index.
   */
  insert(item: HTMLElement, index: number, callback?: () => void): void {
    if (index < 0 || index > this.innerElements.length + 1) {
      throw new Error('Unable to inset it at this index')
    }

    if (this.innerElements.indexOf(item) !== -1) {
      throw new Error('The same item in a carousel? Really? Nope')
    }

    // Avoid shifting content
    const shouldItShift = index <= this.currentSlide && this.innerElements.length

    this.currentSlide = shouldItShift
      ? this.currentSlide + 1
      : this.currentSlide

    this.innerElements.splice(index, 0, item)

    // build a frame and slide to a currentSlide
    this._buildSliderFrame()

    callback && callback.call(this)
  }

  /**
   * Prepend item to carousel.
   */
  prepend(item: HTMLElement, callback?: () => void): void {
    this.insert(item, 0)

    callback && callback.call(this)
  }

  /**
   * Append item to carousel.
   */
  append(item: HTMLElement, callback?: () => void): void {
    this.insert(item, this.innerElements.length + 1)

    callback && callback.call(this)
  }

  /**
   * Removes listeners and optionally restores to initial markup
   * restoreMarkup - Determinants about restoring an initial markup.
   */
  destroy(restoreMarkup: boolean = false, callback?: () => void) {
    this._detachEvents()

    this.selector.style.cursor = 'auto'

    if (restoreMarkup) {
      const slides = document.createDocumentFragment()

      this.innerElements.forEach((element) => {
        slides.appendChild(element)
      })

      this.selector.innerHTML = ''
      this.selector.appendChild(slides)
      this.selector.removeAttribute('style')
    }

    callback && callback.call(this)
  }

  next = (howManySlides?: number = 1, callback?: () => void): void => {
    this._changeSlide('next', howManySlides, callback);
  }

  prev = (howManySlides?: number = 1, callback?: () => void): void => {
    this._changeSlide('prev', howManySlides, callback);
  }

  /**
   * Go to slide with particular index
   */
  goTo(index: number, callback?: () => void): void {
    const innerElementsLength = this.innerElements.length;

    if (innerElementsLength <= this.perPage) {
      return
    }

    const beforeChange = this.currentSlide

    this.currentSlide = this.config.loop
      ? index % innerElementsLength
      : Math.min(Math.max(index, 0), innerElementsLength - this.perPage)

    if (beforeChange !== this.currentSlide) {
      this._slideToCurrent()
      this.config.onChange.call(this)

      callback && callback.call(this)
    }
  }
}

window.Siema = Siema

export {Siema}
