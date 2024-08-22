# Описание
Этот скрипт позволяет добавить под пост кнопку "Заполнение кодов". При нажатии на кнопку появляется окошко со списком доступных кодов. При выборе кода появляется форма, где в поля можно ввести значения. При нажатии на кнопку "Получить код" в поле ответа будет вставлен уже заполненный код.

# Инструкция
## 1. Добавление источника данных
В разделе "Администрирование -> Страницы" необходимо добавить страницу, у которой **адресное имя** будет:
```
_templates_user
```

В блоке с кодом страницы необходимо разместить следующий код:
```html
<div id="userTemplates">

<!-- ==================================================== -->
<!-- НАЗВАНИЕ РАЗДЕЛА -->
<!-- ==================================================== -->

	<!-- ШАБЛОН ИМЯ_ШАБЛОНА -->
	<div class="template">
		<div class="tmpl_name">Тестовый шаблон</div>

		<div class="tmpl_forum_ids">all</div>

		<div class="tmpl_topic_ids">all</div>

		<div class="tmpl_form">
			[
				{
					"name": "Тест текста (без форматирования)",
					"info": "Введённый в это поле текст будет вставлен без изменения регистра.",
					"type": "text",
					"tmpl": "TEST_1"
				},
				{
					"name": "Тест текста (только маленькие буквы)",
					"info": "В этом тексте все буквы будут маленькими.",
					"type": "text",
					"textTransform": "lowercase",
					"default": "QwErTy",
					"tmpl": "TEST_2"
				},
				{
					"name": "Тест текста (КАПС)",
					"info": "Введённый в это поле текст будет вставлен КАПСОМ.",
					"type": "text",
					"textTransform": "uppercase",
					"default": "QwErTy",
					"tmpl": "TEST_3"
				},
				{
					"name": "Тест числа",
					"info": "Просто ввод числа",
					"type": "number",
					"tmpl": "TEST_4"
				},
				{
					"name": "Тест большого текста",
					"info": "Сюда можно ввести много текста. А справа от этого текста html-код ссылки: {{LINK_TEMPLATE}}",
					"type": "textarea",
					"tmpl": "TEST_5"
				},
				{
					"name": "Тест поля с возможностью выбора",
					"info": "Выберите одно значение",
					"type": "select",
					"optList": [
						"Значение 1",
						"Значение 2",
						"Значение 3",
						"Значение 4"
					],
					"tmpl": "TEST_6"
				}
			]
		</div>

		<div class="tmpl_code">
[b]Строка 1:[/b] {{TEST_1}}
[b]Строка 2:[/b] {{TEST_2}}
[b]Строка 3:[/b] {{TEST_3}}
[b]Строка 4:[/b] {{TEST_4}}
[b]Строка 5:[/b] {{TEST_5}}
[b]Строка 6:[/b] {{TEST_6}}
		</div>
	</div>
	<!-- конец ШАБЛОН ИМЯ_ШАБЛОНА -->

	<!-- ШАБЛОН ИМЯ_ШАБЛОНА_2 -->
	...
	<!-- конец ШАБЛОН ИМЯ_ШАБЛОНА_2 -->

<!-- ==================================================== -->
<!-- НАЗВАНИЕ РАЗДЕЛА 2 -->
<!-- ==================================================== -->
	<!-- etc -->

</div>
```

## 2. Добавление кнопки
В разделе "Администрирование -> Формы -> Форма ответа" необходимо добавить следующий код:
```html
<!-- TEMPLATES (info: https://github.com/4eDo/javaScript/tree/main/forums/templates#readme )-->
<input type="button" class="button" id="templateBtn" onclick="showTemplateWindow()" value="Заполнение кодов" style="margin-top:-20px;margin-left:10px;"><div><div class="tmpl_overlay"></div><div class="tmpl_popup"><input type="button" id="tmpl_back-button" onclick="showTemplatesList()" value="Назад" style="display:none"> <input type="button" id="tmpl_close-button" onclick="hideTemplateWindow()" value="x"><div id="templatesList"></div><div id="targetForm" style="display:none"></div></div></div><style>#templateBtn{border:1px solid #000;width:150px;height:30px;text-align:center}.tmpl_overlay{position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,.5);display:none;z-index:1000}.tmpl_popup{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);justify-content:space-evenly;padding:15px;background:url(http://forumstatic.ru/files/001b/d8/2c/82987.jpg) no-repeat center;padding:15px;height:380px;width:650px;overflow:auto;display:none;z-index:1001}#tmpl_close-button{position:absolute;cursor:pointer;top:10px;right:10px;font-size:23px;color:#b45540!important;font-weight:700;text-decoration:none}#tmpl_back-button,#tmpl_get-code-button{display:inline-block;position:relative;top:1px;width:127px;cursor:pointer;padding:5px 8px 5px 8px;background:#313131;text-align:center;font-family:Manrope;font-size:10px;letter-spacing:.6px;text-transform:lowercase;font-weight:700;color:#e8e8e8!important}#tmpl_get-code-button{background-color:#b45540!important}#targetForm table{width:100%;border-collapse:collapse;flex-grow:1}#targetForm td{padding:5px;vertical-align:top}#targetForm td:first-child{text-align:right;padding-right:10px}#targetForm td:first-child label{font-weight:700}#targetForm td:first-child div{font-style:italic}#targetForm input,#targetForm select,#targetForm textarea{width:100%}#targetForm,#templatesList{height:350px;display:flex;flex-direction:column}#templateFormName{align-self:center;font-size:large;padding:2px}.tmpl_template{margin-bottom:10px!important;margin-top:10px!important;font-size:10px;color:#000;text-align:justify;background:#c6c6c6;border:1px solid #757573;padding:8px;font-size:11px;font-family:Manrope;letter-spacing:.6px;text-transform:lowercase;cursor:pointer}</style>

<script type="text/javascript" src="https://4edo.github.io/javaScript/forums/templates/fillTemplatesList.js"></script>
<!-- end TEMPLATES-->
```

## 3. Проверка
После выполнения шагов 1 и 2 под формой ответа появится кнопка "Заполнение кодов". При нажатии на неё будет появляться окошко. В окошке будет доступен для выбора пункт "Тестовый шаблон". При нажатии на него появится форма, которую нужно заполнить. При нажатии на кнопку "Получить код" окошко исчезнет, а в теле сообщения появится заполненный код.

**NB!** Если поле не заполнено, выведется заглушка.

## 4. Добавление своих шаблонов
### Структура шаблона
#### Основной блок
Каждый шаблон рекомендуется для удобства дальнейшей работы оборачивать в комментарии, маркирующие начало шаблона и конец шаблона:
```html
	<!-- ШАБЛОН ИМЯ_ШАБЛОНА -->
		<div class="template">
			...
		</div>
	<!-- конец ШАБЛОН ИМЯ_ШАБЛОНА -->
```
Блок с классом template нужен для того, чтобы скрипт различал, где какой шаблон.

#### Имя шаблона
```html
<div class="tmpl_name">Имя шаблона</div>
```
Данное значение будет использоваться как имя шаблона. Оно будет выводиться в список шаблонов и в качестве заголовка формы.

#### Форумы, где используется
```html
<div class="tmpl_forum_ids">all</div>
```
Если указать ```all```, данный шаблон будет доступен во всех форумах.

Чтобы указать конкретные форумы, введите их идентификаторы ЧЕРЕЗ ПРОБЕЛ.
```html
<div class="tmpl_forum_ids">1 23 4</div>
```

#### Темы (топики), где используется
```html
<div class="tmpl_topic_ids">all</div>
```
Если указать ```all```, данный шаблон будет доступен во всех темах.

Чтобы указать конкретные темы, введите их идентификаторы ЧЕРЕЗ ПРОБЕЛ.
```html
<div class="tmpl_topic_ids">1 23 4</div>
```

#### Форма для заполнения
```html
		<div class="tmpl_form">
			[]
		</div>
```
Список доступных для заполнения полей.

Если оставить просто ```[]```, то никакие поля не будут предложены для заполнения, вставится код как он есть.

Для добавления поля необходимо между квадратными скобками вставить объект:
```json
		[
				{
					"name": "Имя поля",
					"info": "Описание поля",
					"type": "text",
					"tmpl": "TEST_1"
				}
		]
```

##### **ОБЯЗАТЕЛЬНЫЕ ПАРАМЕТРЫ**

**"name"** - здесь необходимо указать имя поля.

**"info"** - здесь можно указать дополнительную информацию, пояснения и т.п. Для того, чтобы дать пример html-ссылки, в строку можно добавить ```{{LINK_TEMPLATE}}```

**"type"** - Выбор типа поля. Доступные значения: ```text```, ```number```, ```textarea```, ```select```
- text: Однострочное для ввода текста
- number: Поле для ввода числа
- textarea: Многострочное поле для ввода текста
- select: Поле с возможностью выбрать одно значение из списка. При выборе этого типа поля необходимо добавить параметр ```optList``` (см. дополнительные параметры)

**"tmpl"** - имя заглушки, вместо которой будет подставлено введённое пользователем значение. ДОЛЖНО БЫТЬ У КАЖДОГО ПОЛЯ УНИКАЛЬНЫМ. Рекомендуется использовать понятные обозначения, записанные капсом: "USERNAME", "AGE", "CONTACTS" и т.п.


##### **ДОПОЛНИТЕЛЬНЫЕ ПАРАМЕТРЫ**

**"textTransform"** - принудительное изменение регистра. Доступные значения: ```lowercase```, ```uppercase```
- lowercase: QwErTy -> qwerty
- uppercase: QwErTy -> QWERTY

**"default"** - Значение поля по умолчанию. Используется для ```text```, ```number```, ```textarea```

**"optList"** - список значений для поля с типом ```select```. Пример заполнения:

```json
		[
				{
					"name": "Тест поля с возможностью выбора",
					"info": "Выберите одно значение",
					"type": "select",
					"optList": [
						"Значение 1",
						"Значение 2",
						"Значение 3",
						"Значение 4"
					],
					"tmpl": "TEST"
				}
			]
```

##### Пример заполнения формы с несколькими полями

```json
		[
				{
					"name": "Тест текста (без форматирования)",
					"info": "Введённый в это поле текст будет вставлен без изменения регистра.",
					"type": "text",
					"tmpl": "TEST_1"
				},
				{
					"name": "Тест текста (только маленькие буквы)",
					"info": "В этом тексте все буквы будут маленькими.",
					"type": "text",
					"textTransform": "lowercase",
					"default": "QwErTy",
					"tmpl": "TEST_2"
				},
				{
					"name": "Тест текста (КАПС)",
					"info": "Введённый в это поле текст будет вставлен КАПСОМ.",
					"type": "text",
					"textTransform": "uppercase",
					"default": "QwErTy",
					"tmpl": "TEST_3"
				},
				{
					"name": "Тест числа",
					"info": "Просто ввод числа",
					"type": "number",
					"tmpl": "TEST_4"
				},
				{
					"name": "Тест большого текста",
					"info": "Сюда можно ввести много текста. А справа от этого текста html-код ссылки: {{LINK_TEMPLATE}}",
					"type": "textarea",
					"tmpl": "TEST_5"
				},
				{
					"name": "Тест поля с возможностью выбора",
					"info": "Выберите одно значение",
					"type": "select",
					"optList": [
						"Значение 1",
						"Значение 2",
						"Значение 3",
						"Значение 4"
					],
					"tmpl": "TEST_6"
				}
			]
```
> ВАЖНО!
> 
> После каждого поля, кроме последнего, должна быть запятая.
> 
> Значения параметров пишутся строго в двойных кавычках.
> 
> После каждого допустимого варианта заполнения, кроме последнего, указанного в параметре optList, должна идти запятая.

#### Код, который будет заполняться
```html
		<div class="tmpl_code">
[b]Строка 1:[/b] {{TEST_1}}
[b]Строка 2:[/b] {{TEST_2}}
[b]Строка 3:[/b] {{TEST_3}}
[b]Строка 4:[/b] {{TEST_4}}
[b]Строка 5:[/b] {{TEST_5}}
[b]Строка 6:[/b] {{TEST_6}}
		</div>
```
Здесь вставляете код - хоть html, хоть bb. Если используете BB, то помните, что отступы будут автоматически перенесены вместе с кодом!

В фигурных скобках указываются идентификаторы полей (указываются в параметре tmpl для каждого поля).



