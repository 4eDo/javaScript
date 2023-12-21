// ==UserScript==
// @name         КРАСИВЫЕ ПОСТЫ
// @version      0.23
// @description  Скрипт для добавления в посты заглавных букв, красных строк и отбивки абзацев
// @namespace    http://tampermonkey.net/
// @author       4eDo (https://github.com/4eDo)
// @match        *://alluvio.ru/*
// ==/UserScript==
$(function() {
const style = `
<style>
	.beutifier_4eDo {
		background-color: #1c1c1c70;
		float: right;
		border: 1px solid #00000040;
		border-radius: 2px;
		vertical-align: middle;
		position: relative;
		margin-top: -50px;
		margin-right: -53px;
	}

	.btn_4eDo{
		width: 21px;
		display: inline-block;
		color: #f0f0f070;
		font-family: monospace;
		font-size: 14px;
 		font-weight: 600;
		height: 20px;
		background-color: #40404030;
		border: 1px solid #00000040;
		border-radius: 2px;
		padding: 5px;
		margin: 5px;
		cursor: pointer;
	}
	.btn_4eDo:hover{
		background-color: #00000050;
	}
	
</style>
`;
const span = '<span style="display:inline-block;margin:0px 10px;"></span>';
const panel = `
	<div class="beutifier_4eDo">
		<span class="btn_4eDo names_4eDo" title="Имена, которые нужно писать с заглавной буквы.">о_О</span>
		<span class="btn_4eDo cases_4eDo" title="Начинать предложения с заглавной буквы." pid="{{pid}}">Aa</span>
		<span class="btn_4eDo redline_4eDo" title="Красная строка." pid="{{pid}}"> &#8594;A</span>
		<span class="btn_4eDo spaces_4eDo" title="Отбивка абзацев пустой строкой." pid="{{pid}}">&#8627;A</span>
	</div>
`;
$('body').append(style);
$('body').append('<div id="panel_4eDo" style="display:block;color:#ffffff;position:fixed;width: 400px;height: 200px;top: 50%;margin-top: -100px;margin-left: -200px;padding: 20px;left: 50%;background-color:rgba(0, 0, 0, 0.9);z-index:990;border-radius: 4px;"><center>Введите имена или фамилии через пробел.</center></div>');
	$('#panel_4eDo').hide();
	$('#panel_4eDo').append('<textarea id="names_4eDo" style="width: 390px; height: 140px;"></textarea>').hide();
	$('#panel_4eDo').append(`<button id="saveBtn_4eDo""> Сохранить. </button>`).hide();
	$('#panel_4eDo').append(`<span id="savedText_4eDo"> Сохранено. </span>`).hide();
	$('#panel_4eDo').append(`<button id="closeBtn_4eDo"> Закрыть. </button>`).hide();
let elements = document.querySelectorAll(".post-box");

elements.forEach(element => {
	let pid = element.firstElementChild.id;
	let newDiv = document.createElement('div');
    newDiv.setAttribute('id', pid+"_4eDo");
	element.prepend(newDiv);
	newDiv.innerHTML = panel.replaceAll("{{pid}}", pid);
});

var namesBtns = document.querySelectorAll(".names_4eDo");
var casesBtns = document.querySelectorAll(".cases_4eDo");
var redlineBtns = document.querySelectorAll(".redline_4eDo");
var spacesBtns = document.querySelectorAll(".spaces_4eDo");

elements.forEach(element => {
	let pid = element.firstElementChild.id;
	let newDiv = document.createElement('div');
    newDiv.setAttribute('id', pid+"_4eDo");
	element.prepend(newDiv);
	newDiv.innerHTML = panel.replaceAll("{{pid}}", pid);
});
namesBtns.forEach(element => {
	element.addEventListener('click', function () {
        addNamesToCaseList();
    });
});

casesBtns.forEach(element => {
	element.addEventListener('click', function () {
        toCamelCase(element.getAttribute("pid"));
    });
});
redlineBtns.forEach(element => {
	element.addEventListener('click', function () {
        addRedLine(element.getAttribute("pid"));
    });
});
spacesBtns.forEach(element => {
	element.addEventListener('click', function () {
        addSpaceBefore(element.getAttribute("pid"));
    });
});

document.getElementById("saveBtn_4eDo").addEventListener('click', function () {
	saveNamesInCaseList();
});
document.getElementById("closeBtn_4eDo").addEventListener('click', function () {
	closeMe4eDo();
});

function setNamesForPlugin(names) {

	$.ajax({
		url: '/api.php',
		method: 'post',
		dataType: 'json',
		data: {
			token: ForumAPITicket,
			method: "storage.set",
			key: "namesForUppercase_4eDo",
			value: names
		},
		async: false,
		success: function(data){
			// console.log(data);
		}
	});
}

function getNamesForPlugin() {
	let names = "";
	$.ajax({
		url: '/api.php',
		method: 'get',
		dataType: 'json',
		data: {
			method: "storage.get",
			key: "namesForUppercase_4eDo"
		},
		async: false,
		success: function(data){
			names = data.response.storage.data.namesForUppercase_4eDo;
		}
	});
	return names;
}

function addNamesToCaseList(){
	$('#panel_4eDo').show();
	var names = getNamesForPlugin();
	$("#names_4eDo").val(names ? names : "");
	$('#saveBtn_4eDo').show();
	$('#savedText_4eDo').hide();
	$('#closeBtn_4eDo').show();
}
function saveNamesInCaseList(){
	$('#saveBtn_4eDo').hide();
	
	var names = $("#names_4eDo").val();
	let namesArr = names.split(' ');
		namesArr.sort();
		names = namesArr.join(' ');
	setNamesForPlugin(names);
	$('#savedText_4eDo').show();
	$('#closeBtn_4eDo').show();
}
function closeMe4eDo(){
	$('#panel_4eDo').hide();
	$('#savedText_4eDo').hide();
	$('#closeBtn_4eDo').hide();
}

function toCamelCase(pid) {
	let postContent = document.getElementById(pid);
	var saveLinks = /(<div class="html-post-box" style="padding-bottom:1em"><div class="html-inner"><div class="html-content">.+<\/div><\/div><\/div>|<img.+>|<a.+<\/a>)/g;
	let key = postContent.innerHTML;
	let savedLinks = [];
	let linksIterator = 0;
	key = key.replaceAll(saveLinks, match => { linksIterator++; savedLinks[linksIterator] = match; return "{{".concat(linksIterator, "}}");});

	
	var pattern = /((<br>)|(<p>)|(\?|\.|!)) ?—? ?((<span style="display:inline-block;margin:0px 10px;"><\/span>)|(<\/?strong>)|(<\/?em( class="bbuline")?>))? ?—? ?((<span style="display:inline-block;margin:0px 10px;"><\/span>)|(<\/?strong>)|(<em\/?( class="bbuline")?>))? ?[a-zA-Zа-яёА-ЯЁ]|(<\/?strong>) ?[a-zA-Zа-яёА-ЯЁ]/g;
	key = key.replaceAll(pattern, match =>  match.substring(0, match.length - 1) + match.at(-1).toUpperCase());
	
	var namesStr = getNamesForPlugin();
	if(namesStr) {
		let names = namesStr.split(' ');
		let regexp = new RegExp("[ ->]" + "(" + names.join("|") + ")", "gi");
		console.log(regexp);
		key = key.replaceAll(regexp, match => match.charAt(0) + match.charAt(1).toUpperCase() + match.slice(2).toLowerCase());
	}
	
	for(let i = 0; i <= savedLinks.length; i++) {
		key = key.replace("{{" + i + "}}", savedLinks[i]);
	}

	postContent.innerHTML = key;
}
function addRedLine(pid) {
	let postContent = document.getElementById(pid);
	let key = postContent.innerHTML;
	key = key.replaceAll(span, "");
	key = key.replace(/(<br>)+/g, "<br>" + span);
	postContent.innerHTML = key;
	
	let ps = document.querySelectorAll("#"+ pid + " p");
	ps.forEach(element => {
		let newSpan = document.createElement('span');
		newSpan.setAttribute('style', "display:inline-block;margin:0px 10px;");
		element.prepend(newSpan);
	});
}
function addSpaceBefore(pid) {
	let postContent = document.getElementById(pid);
	let key = postContent.innerHTML;
	key = key.replaceAll(/(<span style="display:inline-block;margin:0px 10px;"><\/span><br>)+/g, "<br>");
	key = key.replaceAll(/(<br>)+/g, "<br><br>");
	key = key.replaceAll(/(<p>)(<br>)*/g, "<p>");
	postContent.innerHTML = key;
	
	let ps = document.querySelectorAll("#"+ pid + " p");
	ps.forEach(element => {
		let newSpan = document.createElement('br');
		element.prepend(newSpan);
	});
}

console.log("~ init postBeautifierPlugin ~");

});
