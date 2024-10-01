$(document).ready(function() {
      let hotkeysEnabled = localStorage.getItem('hotkeysEnabled') === 'true'; // Проверяем состояние из localStorage
      let useCtrlShiftIndent = localStorage.getItem('useCtrlShiftIndent') === 'true';
      let hotkeysButton = $('#hotkeysButton');
      let indentCheckbox = $('#indentCheckbox');
      let hotkeys = $('#hotkeys');

      if (hotkeysEnabled) {
        hotkeysButton.text('Отключить горячие клавиши');
        indentCheckbox.prop('checked', useCtrlShiftIndent);
        hotkeys.show();
      } else {
        hotkeysButton.text('Включить горячие клавиши');
        indentCheckbox.hide();
        hotkeys.hide();
      }

      // Обработка нажатия кнопки "Включить/Отключить горячие клавиши"
      hotkeysButton.click(function() {
        hotkeysEnabled = !hotkeysEnabled;
        localStorage.setItem('hotkeysEnabled', hotkeysEnabled); // Сохраняем состояние в localStorage

        if (hotkeysEnabled) {
          hotkeysButton.text('Отключить горячие клавиши');
          indentCheckbox.prop('checked', useCtrlShiftIndent);
          hotkeys.show();
        } else {
          hotkeysButton.text('Включить горячие клавиши');
          indentCheckbox.hide();
          hotkeys.hide();
        }
      });

      // Обработка изменения состояния чекбокса "использовать ctrl+Shift для вставки отступа"
      indentCheckbox.change(function() {
        useCtrlShiftIndent = $(this).is(':checked');
        localStorage.setItem('useCtrlShiftIndent', useCtrlShiftIndent); // Сохраняем состояние в localStorage
      });

      // Отслеживание нажатия клавиш
      hotkeys.keydown(function(e) {
        if (e.code === 'Tab') {
          e.preventDefault(); // Отменяем стандартное действие Tab
          console.log('Клавиша Tab нажата!');
          // Добавьте ваш код здесь
        } else if (e.ctrlKey) {
          switch (e.key.toLowerCase()) {
            case 'b': // Ctrl+B
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
            case 'shift': // Ctrl+Shift
              if (useCtrlShiftIndent) {
                e.preventDefault();
                bbcode(' [indent] ', '');
              }
              break;
          }
        } 
      });
    });
