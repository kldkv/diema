const Siema = require('../siema');

test('mergeSettings', () => {
  const onInit = () => {};
  const onChange = () => {};
  const siema = new Siema({selector: '.lolkek', duration: 140, loop: true, onInit, onChange});
  const config = siema.config;

  expect(config).toEqual({
    selector: '.lolkek',
    duration: 140,
    easing: 'ease-out',
    perPage: 1,
    startIndex: 0,
    draggable: true,
    multipleDrag: true,
    threshold: 20,
    loop: true,
    rtl: false,
    onInit,
    onChange,
  })
});
