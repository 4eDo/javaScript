$(document).ready(function() {
  // Отключаем сочетания клавиш "по умолчанию" и задаём новые.
  $(document).keydown(function(e) {
    if (e.code === 'Tab') {
      e.preventDefault(); // Отменяем стандартное действие Tab
      console.log('Клавиша Tab нажата!');
      // Добавьте ваш код здесь
    } else if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b': // Ctrl+U
          e.preventDefault();
          bbcode('[b]', '[/b]');
          break;
        case 'u': // Ctrl+U
          e.preventDefault();
          bbcode('[u]', '[/u]');
          break;
        case 's': // Ctrl+S
          e.preventDefault();
          bbcode('[s]', '[/s]');
          break;
        case 'i': // Ctrl+I
          e.preventDefault();
          bbcode('[i]', '[/i]');
          break;
        case 'q': // Ctrl+Q
          e.preventDefault();
          bbcode('[quote]', '[/quote]');
          break;
        case 'shift': // ctrl+shift
          e.preventDefault();
          bbcode(' [indent] ', '');
          break;
      }
    } 
  });
});
