
$(function() {
const style = `
<style>
	.beutifier_4eDo {
		background-color: #40404030;
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
	
	.redLine_4eDo{
		width: 40px;
		display: inline-block;
	}
</style>
`;
const span = '<span class="redLine_4eDo"></span>';
const panel = `
	<div class="beutifier_4eDo">
		<span class="btn_4eDo cases_4eDo" title="Начинать предложения с заглавной буквы." pid="{{pid}}">Aa</span>
		<span class="btn_4eDo redline_4eDo" title="Красная строка." pid="{{pid}}> &#8594;A</span>
		<span class="btn_4eDo spaces_4eDo" title="Отбивка абзацев пустой строкой." pid="{{pid}}>&#8627;A</span>
	</div>
`;
$('body').append(style);
let elements = document.querySelectorAll(".post-box");

elements.forEach(element => {
	let pid = element.firstElementChild.id;
	let newDiv = document.createElement('div');
    newDiv.setAttribute('id', pid+"_4eDo");
	element.prepend(newDiv);
	newDiv.innerHTML = panel.replaceAll("{{pid}}", pid);
});

var casesBtns = document.getElementsByClassName('cases_4eDo');
var redlineBtns = document.getElementsByClassName('redline_4eDo');
var spacesBtns = document.getElementsByClassName('spaces_4eDo');


for (var i = 0; i < casesBtns.length; i++){
    casesBtns[i].addEventListener('click', function () {
        toCamelCase(casesBtns[i].getAttribute("pid"));
    });
}
for (var i = 0; i < redlineBtns.length; i++){
    redlineBtns[i].addEventListener('click', function () {
        addRedLine(redlineBtns[i].getAttribute("pid"));
    });
}
for (var i = 0; i < spacesBtns.length; i++){
    spacesBtns[i].addEventListener('click', function () {
        addSpaceBefore(spacesBtns[i].getAttribute("pid"));
    });
}

function toCamelCase(pid) {
	let postContent = document.getElementById(pid);
	let key = postContent.innerHTML;
	key = key.replace(/<span class="redLine_4eDo"><\/span>(.)/g, match => '<span class="redLine_4eDo"></span>' + match[34].toUpperCase());
	key = key.replace(/<span class="redLine_4eDo"><\/span>— <strong>(.)/g, match => '<span class="redLine_4eDo"></span>— <strong>' + match[44].toUpperCase());
	key = key.replace(/<span class="redLine_4eDo"><\/span>— <em class="bbuline">(.)/g, match => '<span class="redLine_4eDo"></span>— <em class="bbuline">' + match[56].toUpperCase());
	key = key.replace(/<span class="redLine_4eDo"><\/span>— (.)/g, match => '<span class="redLine_4eDo"></span>— ' + match[36].toUpperCase());
	key = key.replace(/\. (.)/g, match => ". " + match[2].toUpperCase());
	key = key.replace(/<br>(.)/g, match => "<br>" + match[4].toUpperCase());
	key = key.replace(/<br>— <strong>(.)/g, match => "<br>— <strong>" + match[14].toUpperCase());
	key = key.replace(/<br>— <em class="bbuline">(.)/g, match => '<br>— <em class="bbuline">' + match[26].toUpperCase());
	key = key.replace(/<br>— (.)/g, match => "<br>— " + match[6].toUpperCase());
	key = key.replace(/px;">(.)/g, match => 'px;">' + match[5].toUpperCase());
	postContent.innerHTML = key;
	
}
function addRedLine(pid) {
	let postContent = document.getElementById(pid);
	let key = postContent.innerHTML;
	key = key.replaceAll(span, "");
	key = key.replace(/<br>/g, "<br>" + span);
	postContent.innerHTML = key;
	
	let ps = document.querySelectorAll("#"+ pid + " p");
	ps.forEach(element => {
		let newSpan = document.createElement('span');
		newSpan.setAttribute('class', "redLine_4eDo");
		element.prepend(newSpan);
	});
}
function addSpaceBefore(pid) {
	let postContent = document.getElementById(pid);
	let key = postContent.innerHTML;
	key = key.replace(/<br><br>/g, "<br>");
	key = key.replace(/<br>/g, "<br><br>");
	postContent.innerHTML = key;
	
	let ps = document.querySelectorAll("#"+ pid + " p");
	ps.forEach(element => {
		let newSpan = document.createElement('br');
		element.prepend(newSpan);
	});
}

console.log("~ init postBeautifierPlugin ~");

});
