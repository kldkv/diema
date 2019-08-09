### Work in progress

---
# Diema - Lightweight and simple carousel with no dependencies and it's fork popular library Siema, who now is deprecated by author.

Diema is a lightweight (only 3kb gzipped) carousel plugin with no dependencies and no styling.
It is free to use on personal and commercial projects. Use it with your favourite module bundler or
by manually injecting the script into your project.

## Installation

Setup is trivially easy. A little bit of markup...

```html
<div class="diema">
  <div>Hi, I'm slide 1</div>
  <div>Hi, I'm slide 2</div>
  <div>Hi, I'm slide 3</div>
  <div>Hi, I'm slide 4</div>
</div>
```

If you are using a module bundler like Webpack or Browserify...

```
yarn add diema
```

```js
import Diema from 'diema';
new Diema();
```

...or manually inject the minified script into your website.

```html
<script src="diema.min.js"></script>
<script>
  new Diema();
</script>
```

## Options

Diema comes with a few (optional) settings that you can change by passing an object as an argument. Default values are presented below.

```js
new Diema({
  selector: '.diema',
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
});
```

## Browser support

- IE10
- Chrome 12
- Firefox 16
- Opera 15
- Safari 5.1
- Android Browser 4.0
- iOS Safari 6.0
