// URL страницы с шаблонами
const url = '/pages/_templates_user';

var currentForum = FORUM.topic.forum_id;
var currentTopic = $get.id;

// Инициализируем пустой массив для хранения шаблонов
var userTemplateList = [];

const openPopupButton = document.getElementById('templateBtn');
    const closePopupButton = document.getElementById('tmpl_close-button');
    const overlay = document.querySelector('.tmpl_overlay');
    const popup = document.querySelector('.tmpl_popup');

function showTemplateWindow() {
      overlay.style.display = 'block';
      popup.style.display = 'block';
}

function hideTemplateWindow() {
      overlay.style.display = 'none';
      popup.style.display = 'none';
}

// Функция для получения и обработки HTML
async function fetchAndParseTemplates() {
    try {
        // Получаем ответ в виде массива байтов
        let response = await fetch(url);
        let buffer = await response.arrayBuffer();

        // Декодируем массив байтов в строку с правильной кодировкой
        let decoder = new TextDecoder('windows-1251'); // Проверьте кодировку
        let htmlText = decoder.decode(buffer);

        // Выводим HTML текст для проверки
        console.log("HTML Text:", htmlText);

        // Парсим полученный HTML
        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlText, 'text/html');

        // Получаем блок userTemplates
        let userTemplates = doc.getElementById('userTemplates');
        // console.log("User Templates Block:", userTemplates);

        if (!userTemplates) {
            console.error("userTemplates не найден.");
            return;
        }

        // Перебираем все элементы с классом "template"
        let templates = userTemplates.getElementsByClassName('template');
	    let hasTemplates = false;
        let id = 0;

        for (let template of templates) {
            // Извлекаем данные из соответствующих блоков
            let name = template.querySelector('.tmpl_name').innerText.trim();
            let forums = template.querySelector('.tmpl_forum_ids').innerText.trim().split(" ");
            let topics = template.querySelector('.tmpl_topic_ids').innerText.trim().split(" ");
            let form = JSON.parse(template.querySelector('.tmpl_form').innerHTML.trim());
            let code = template.querySelector('.tmpl_code').innerHTML.trim();

            // Проверка данных перед добавлением в массив
            // console.log("Template:", { name, forums, topics, form, code });

			if(
				(forums.includes("all") || forums.includes(currentForum))
				|| (topics.includes("all") || topics.includes(currentTopic))
			) {
				// Создаём объект и добавляем его в массив
				let templateObj = {
					id: id,
					name: name,
					forums: forums,
					topics: topics,
					form: form,
					code: code
				};
				hasTemplates = true;
				userTemplateList.push(templateObj);
				id++;
			}
            
        }
	    if(!hasTemplates) {document.getElementById('templateBtn').style.display = 'none';}

        // Добавляем блоки в DOM
        populateTemplateList();

    } catch (error) {
        console.error('Ошибка при получении или обработке данных:', error);
    }
}


// Функция для добавления блоков в элемент с id="templatesList"
function populateTemplateList() {
	let templatesList = document.getElementById('templatesList');

	for (let template of userTemplateList) {
		// Создаём новый div элемент
		let templateDiv = document.createElement('div');
		templateDiv.className = 'tmpl_template';
		templateDiv.setAttribute('onclick', `drawForm(${template.id})`);
		templateDiv.innerText = template.name;

		// Добавляем новый div в элемент templatesList
		templatesList.appendChild(templateDiv);
	}

}

function drawForm(id) {
    let targetTmpl = userTemplateList.find(template => template.id === id);

    if (!targetTmpl) {
        console.error(`Template with id ${id} not found.`);
        return;
    }

    console.log("Target Template:", targetTmpl);
    showTargetForm();

    let targetForm = document.getElementById('targetForm');
    targetForm.innerHTML = `<div id="templateFormName">${targetTmpl.name}</div>`;

    // Создаём таблицу
    let table = document.createElement('table');

    // Перебираем массив targetTmpl.form и добавляем строки в таблицу
    targetTmpl.form.forEach((field) => {
        let row = document.createElement('tr');

        // Создаём ячейку для метки
        let labelCell = document.createElement('td');
        let label = document.createElement('label');
        label.innerText = field.name;
        let labelDescr = document.createElement('div');
        labelDescr.innerText = field.info
		.replaceAll("{{LINK_TEMPLATE}}", `<a href='ссылка на профиль'>ваш любимчик</a>`)
		.replaceAll("<br>", `\n\n`);
        labelCell.appendChild(label);
        labelCell.appendChild(labelDescr);

        // Создаём ячейку для поля ввода
        let inputCell = document.createElement('td');
        let inputElement;

        if (field.type === 'text') {
            inputElement = document.createElement('input');
            inputElement.type = 'text';
			if(field.default) {
				inputElement.value=field.default;
			}
        } else if (field.type === 'textarea') {
            inputElement = document.createElement('textarea');
			if(field.default) {
				inputElement.innerText=field.default;
			}
        } else if (field.type === 'number') {
            inputElement = document.createElement('input');
            inputElement.type = 'number';
			if(field.default) {
				inputElement.value=field.default;
			}
        } else if (field.type === 'select') {
            inputElement = document.createElement('select');

            field.optList.forEach(opt => {
                let option = document.createElement('option');
                option.value = opt;
                option.innerText = opt;
                inputElement.appendChild(option);
            });
        }
		if(field.textTransform) {
			inputElement.setAttribute('data-textTransform', field.textTransform);
		}

        inputElement.id = `field_${field.tmpl}`;
	inputElement.setAttribute('style', "color: #000000 !important");
        inputCell.appendChild(inputElement);

        // Добавляем ячейки в строку таблицы
        row.appendChild(labelCell);
        row.appendChild(inputCell);

        // Добавляем строку в таблицу
        table.appendChild(row);
    });

    // Добавляем таблицу в форму
    targetForm.appendChild(table);

    // Создаём кнопку "Получить код"
    let button = document.createElement('div');
	button.id = 'tmpl_get-code-button';
    button.innerText = 'Получить код';
    button.setAttribute('onclick', `fillCode(${id})`);

    // Добавляем кнопку в форму
    targetForm.appendChild(button);
}



function fillCode(id) {
    // Получаем текущий выбранный шаблон по id
    let selectedTemplate = userTemplateList.find(template => template.id == id);

    if (!selectedTemplate) {
        console.error('Шаблон не найден.');
        return;
    }

    // Получаем исходный код шаблона
    let code = selectedTemplate.code;

    // Перебираем поля формы и заменяем плейсхолдеры в коде
    selectedTemplate.form.forEach(field => {
        let placeholder = `{{${field.tmpl}}}`; // Формируем плейсхолдер, например, {{ANK_LINK}}
        let inputValue = document.getElementById(`field_${field.tmpl}`).value; // Получаем значение из поля ввода
		if(inputValue) {
			// Заменяем плейсхолдер в коде
			if(document.getElementById(`field_${field.tmpl}`).getAttribute("data-textTransform")) {
				switch(document.getElementById(`field_${field.tmpl}`).getAttribute("data-textTransform")) {
					case "lowercase": inputValue = inputValue.toLowerCase(); break;
					case "uppercase": inputValue = inputValue.toUpperCase(); break;
				}
			}
        	code = code.replace(placeholder, inputValue);
		}
        
    });

    // Выводим результат
    console.log("Сгенерированный код:", code);
	insert(code);
	hideTemplateWindow();
}


    // Функция для показа формы и скрытия списка шаблонов
    function showTargetForm() {
        document.getElementById('templatesList').style.display = 'none';
        document.getElementById('targetForm').style.display = 'flex';
        document.getElementById('tmpl_back-button').style.display = 'flex';
    }

    // Функция для показа списка шаблонов и скрытия формы
    function showTemplatesList() {
        document.getElementById('templatesList').style.display = 'flex';
        document.getElementById('targetForm').style.display = 'none';
        document.getElementById('tmpl_back-button').style.display = 'none';
    }

// Вызываем функцию для получения и обработки данных
fetchAndParseTemplates();
