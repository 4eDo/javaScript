const _CHAR_TEMPLATE = CHAR_TEMPLATE.innerHTML;
const _NAMELIST_TEMPLATE = NAMELIST_TEMPLATE.innerHTML;
const _SURNAMELIST_TEMPLATE = SURNAMELIST_TEMPLATE.innerHTML;
const _FACELIST_TEMPLATE = FACELIST_TEMPLATE.innerHTML;
const _JOBLIST_TEMPLATE = JOBLIST_TEMPLATE.innerHTML;
const _FIRSTLETTER_TEMPLATE = FIRSTLETTER_TEMPLATE.innerHTML;
const _JOBPATH_TEMPLATE = JOBPATH_TEMPLATE.innerHTML;

let _stat_all = 0;
let _stat_f = 0;
let _stat_m = 0;
let _stat_de = 0;
let _stat_cr = 0;
let _stat_mm = 0;
let _stat_n = 0;

// URL страницы со списком карточек пользователей
// const url = '/pages/_characters_lists'; // Основной адрес
const url = 'https://4edo.github.io/javaScript/forums/characters_lists/4eDo_characters_lists.html'; // Адрес для тестов

const charset = url.includes("github") ? "utf-8" : 'windows-1251';

var json;
var roles = {};

// Функция для получения и обработки HTML
async function fetchAndParseTemplates() {
    try {
        // Получаем ответ в виде массива байтов
        let response = await fetch(url);
        let buffer = await response.arrayBuffer();

        // Декодируем массив байтов в строку с правильной кодировкой
        let decoder = new TextDecoder(charset); // Проверка кодировки. У mybb это windows-1251
        let htmlText = decoder.decode(buffer);

//         console.log("HTML Text:", htmlText);

        // Парсим полученный HTML
        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlText, 'text/html');

        // Получаем блок roles_4edo
        let rolesBlock = doc.getElementById('roles_4edo');
        // console.log("Characters cards Block:", rolesBlock);

        if (!rolesBlock) { 
            console.error("roles_4edo  не найден.");
            return;
        }

        // Парсим куда надо
        json = rolesBlock.innerText;
        roles = JSON.parse(json);

		// Загружаем список карточек на страницу
		loadAllChars();
    } catch (error) {
        console.error('Ошибка при получении или обработке данных:', error);
    }
}

fetchAndParseTemplates();


// Функция сортировки JSON
function sortBy(prop, DESC_ASC) {
	let order = DESC_ASC.toUpperCase() == "ASC" ? 1 : -1;
	return function (a, b) {
		if (a[prop] > b[prop]) {
			return 1 * order;
		} else if (a[prop] < b[prop]) {
			return -1 * order;
		}
		return 0;
	};
}
// //Usage
// roles.sort( sortBy("age", "ASC") );
// console.log(roles);
// roles.sort( sortBy("age", "DESC") );
// console.log(roles);


// Загрузка всех карточек персонажей
function loadAllChars() {
	roles.sort(sortBy("name", "ASC"));
	cleanList();
	for (let i = 0; i < roles.length; i++) {
		_stat_all++;
		let sideClass = "";
		let sideRu = "";
		switch (
			roles[i].side.toUpperCase() //de/cr/mm/n
		) {
			case "DE":
				sideClass = "death";
				sideRu = "пожиратели смерти";
				_stat_de++;
				break;
			case "CR":
				sideClass = "resistance";
				sideRu = "гражданское сопротивление";
				_stat_cr++;
				break;
			case "MM":
				sideClass = "ministry";
				sideRu = "министерство магии";
				_stat_mm++;
				break;
			case "N":
				sideClass = "neutral";
				sideRu = "нейтралитет";
				_stat_n++;
				break;
		}
		if (roles[i].sex == "m") {
			_stat_m++;
		} else {
			_stat_f++;
		}

		let sub = roles[i].sub ? " (" + roles[i].sub.toLowerCase() + ")" : "";
		let temp = _CHAR_TEMPLATE
			.replace("{{sideClass}}", sideClass)
			.replace("{{sex}}", roles[i].sex)
			.replace("{{profile}}", roles[i].profile)
			.replace("{{name}}", roles[i].name.toUpperCase())
			.replace("{{surname}}", roles[i].surname.toUpperCase())
			.replace("{{age}}", roles[i].age)
			.replace("{{blood}}", roles[i].blood)
			.replace("{{face}}", roles[i].face)
			.replace("{{sideRu}}", sideRu)
			.replace("{{sub}}", sub)
			.replace("{{job}}", roles[i].job);

		$(".all-chars").append(temp);
		// console.log(temp);
	}
	stat_all.innerText = _stat_all;
	stat_f.innerText = _stat_f;
	stat_m.innerText = _stat_m;
	stat_de.innerText = _stat_de;
	stat_cr.innerText = _stat_cr;
	stat_mm.innerText = _stat_mm;
	stat_n.innerText = _stat_n;
}



function cleanList() {
	$(".all-chars").html("");
}

function capitalizeFLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function viewNames() {
	roles.sort(sortBy("name", "ASC"));
	
	$("#addonAll").hide();
	$("#addonM").show();
	$("#addonF").show();
	
	$("#addonAll").html("");
	$("#addonM").html("MALES:");
	$("#addonF").html("FEMALES:");

	let currentFirstLetter = "";
	for (let i = 0; i < roles.length; i++) {
		let temp = _NAMELIST_TEMPLATE
			.replace("{{name}}", capitalizeFLetter(roles[i].name))
			.replace("{{surname}}", capitalizeFLetter(roles[i].surname))
			.replace("{{side}}", roles[i].side)
			.replace("{{profile}}", roles[i].profile);

		if (currentFirstLetter != roles[i].name.charAt(0)) {
			currentFirstLetter = roles[i].name.charAt(0);
			temp =
				_FIRSTLETTER_TEMPLATE.replace("{{letter}}", currentFirstLetter) + temp;
		}
		if (roles[i].sex.toUpperCase() == "F") {
			$("#addonF").append(temp);
		} else {
			$("#addonM").append(temp);
		}
	}
}

function viewSurnames() {
	roles.sort(sortBy("surname", "ASC"));
	
	$("#addonM").hide();
	$("#addonF").hide();
	$("#addonAll").show();
	
	$("#addonAll").html("");
	$("#addonM").html("");
	$("#addonF").html("");

	let currentFirstLetter = "";
	for (let i = 0; i < roles.length; i++) {
		let temp = _SURNAMELIST_TEMPLATE;
		temp = temp
			.replace("{{name}}", capitalizeFLetter(roles[i].name))
			.replace("{{surname}}",  roles[i].surname.toUpperCase())
			.replace("{{side}}", roles[i].side)
			.replace("{{profile}}", roles[i].profile);

		if (currentFirstLetter != roles[i].surname.charAt(0)) {
			currentFirstLetter = roles[i].surname.charAt(0);
			temp =
				_FIRSTLETTER_TEMPLATE.replace("{{letter}}", currentFirstLetter) + temp;
		}
		$("#addonAll").append(temp);
	}
}

function viewJobs() {
	roles.sort(sortBy("job", "ASC"));
	
	$("#addonM").hide();
	$("#addonF").hide();
	$("#addonAll").show();
	$("#addonAll").html("");
	$("#addonM").html("");
	$("#addonF").html("");

	let path = [];
	let currLevel = 0;
	for (let i = 0; i < roles.length; i++) {
		let tempPath = roles[i].job.split(", ");
		console.log(tempPath);
		let pathTemp = "";
		let pathStr = "";
		if (!path || path.length < 1) {
			for (let j = 0; j < tempPath.length - 1; j++) {
				pathTemp += _JOBPATH_TEMPLATE
					.replace("{{pathLevel}}", j)
					.replace("{{path}}", tempPath[j]);
				pathStr += tempPath[j] + ", ";
				currLevel = j;
			}
			$("#addonAll").append(pathTemp);
			path = tempPath;
		} else {
			let maxLevel = tempPath.length - 1;
			for (let j = 0; j < maxLevel; j++) {
				if (
					path[j] &&
					tempPath[j] &&
					path[j].toUpperCase() == tempPath[j].toUpperCase()
				)
					continue;

				pathTemp += _JOBPATH_TEMPLATE
					.replace("{{pathLevel}}", j)
					.replace("{{path}}", tempPath[j]);
				pathStr += tempPath[j] + ", ";
				currLevel = j;
			}
			currLevel = maxLevel;
			pathStr += tempPath[maxLevel] + ", ";
			$("#addonAll").append(pathTemp);
			path = tempPath;
		}

		let temp = _JOBLIST_TEMPLATE
			.replace("{{name}}", capitalizeFLetter(roles[i].name))
			.replace("{{surname}}", capitalizeFLetter(roles[i].surname))
			.replace("{{side}}", roles[i].side)
			.replace("{{profile}}", roles[i].profile)
			.replace("{{currLevel}}", currLevel)
			.replace("{{fullPath}}", pathStr)
			.replace("{{job}}", !path ? path[currLevel] : tempPath[currLevel]); // Используем tempPath для job в блоке else

		$("#addonAll").append(temp);
	}
}

function viewFaces() {
	roles.sort(sortBy("face", "ASC"));
	
	$("#addonAll").hide();
	$("#addonM").show();
	$("#addonF").show();
	
	$("#addonAll").html("");
	$("#addonM").html("MALES:");
	$("#addonF").html("FEMALES:");

	let currentFirstLetter = "";
	for (let i = 0; i < roles.length; i++) {
		let temp = _FACELIST_TEMPLATE;
		temp = temp
			.replace("{{name}}", capitalizeFLetter(roles[i].name))
			.replace("{{surname}}", capitalizeFLetter(roles[i].surname))
			.replace("{{face}}", roles[i].face.toUpperCase())
			.replace("{{profile}}", roles[i].profile);

		if (currentFirstLetter != roles[i].face.charAt(0)) {
			currentFirstLetter = roles[i].face.charAt(0);
			temp =
				_FIRSTLETTER_TEMPLATE.replace("{{letter}}", currentFirstLetter) + temp;
		}
		if (roles[i].sex.toUpperCase() == "F") {
			$("#addonF").append(temp);
		} else {
			$("#addonM").append(temp);
		}
	}
}
$(".chars-nav .filters").click(function () {
	$(".listContainer").hide();
	$(".all-chars").show();
	$(".chars-nav a").removeClass("current");
	$(this).addClass("current");
	let newSelection = $(this).attr("rel");
	$(".char")
		.not("." + newSelection)
		.slideUp();
	$("." + newSelection).slideDown();
});

$(".chars-nav .lists").click(function () {
	
	$(".all-chars").hide();
	$(".chars-nav a").removeClass("current");
	$(this).addClass("current");
});