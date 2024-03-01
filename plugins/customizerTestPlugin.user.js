// ==UserScript==
// @name         ТЕСТ КАСТОМИЗАЦИИ
// @version      0.2
// @description  Скрипт для теста кастомизации на noStressCross
// @namespace    http://tampermonkey.net/
// @author       4eDo (https://github.com/4eDo)
// @match        *://nostresscross.rusff.me/*
// ==/UserScript==
$(function() {
	const BODY_TEMPLATE = `
	<table>
	  <tr>
		<td width="150px;">Фон профиля</td>
		<td><textarea id="{{pid}}_top-img_4eDo" style="width: 390px; height: 30px;">{{top-img}}</textarea></td>
	  </tr>
	  <tr>
		<td>Аватар</td>
		<td><textarea id="{{pid}}_avatar_4eDo" style="width: 390px; height: 30px;">{{avatar}}</textarea></td>
	  </tr>
	  <tr>
		<td>Эмодзи</td>
		<td><textarea id="{{pid}}_emoji_4eDo" style="width: 390px; height: 30px;">{{emoji}}</textarea></td>
	  </tr>
	  <tr>
		<td>Личное звание</td>
		<td><textarea id="{{pid}}_lz_4eDo" style="width: 390px; height: 90px;">{{lz}}</textarea></td>
	  </tr>
	  <tr>
		<td>Подпись</td>
		<td><textarea id="{{pid}}_subscription_4eDo" style="width: 390px; height: 90px;">{{subscription}}</textarea></td>
	  </tr>
	</table>
	<button name="button" id="{{pid}}_look_4eDo">ПРИМЕРИТЬ</button>
	<div id="{{pid}}_style_4eDo"></div>
	`;
	initAll_4eDo();

	function initAll_4eDo() {
		console.log("init");
		let elements = document.querySelectorAll(".post");

		elements.forEach(element => {
			let pid = element.id;
			let topImg = getComputedStyle(document.querySelector("#" + pid + " > div > div.post-author")).backgroundImage;
			let avatar = document.querySelector("#" + pid + " > div > div.post-author > ul > li.pa-avatar.item2 > img");
			let emoji = document.querySelector("#" + pid + " > div > div.post-author > ul > li.pa-fld6 > img");
			let lz = document.querySelector("#" + pid + " > div > div.post-author > ul > li.pa-fld2 > bio");
			let sign = document.querySelector("#" + pid + "-content > dl");
			let signContent = document.querySelector("#" + pid + "-content > dl > dd > p");
			let temp = BODY_TEMPLATE.replaceAll("{{pid}}", pid)
			.replaceAll("{{top-img}}", topImg ? topImg : "")
			.replaceAll("{{avatar}}", avatar ? avatar.src : "")
			.replaceAll("{{emoji}}", emoji ? emoji.src : "")
			.replaceAll("{{lz}}", lz ? lz.innerHTML  : "")
			.replaceAll("{{subscription}}", sign ? signContent.innerHTML  : "")
			.replaceAll("{{uid}}", element.dataset.userId ? element.dataset.userId : "");
			temp += sign ? sign.outerHTML  : "";
			document.querySelector("#" + pid + "-content").innerHTML = temp;
			
			document.querySelector("#" + pid + "-content > dl").addEventListener('click', function () {
				look_4eDo(pid, uid);
			});
		});
	}

	function look_4eDo(pid, uid){
		console.log("look...");
		let topImg = getComputedStyle(document.querySelector("#" + pid + " > div > div.post-author")).backgroundImage;
		let topImg_new = document.querySelector("#" + pid + "_top-img_4eDo").value;
		if(topImg_new != '') {
			let style = '<style>[data-user-id="' + uid + '"].post .post-author {background: ' + topImg_new +' no-repeat top !important;}</style>';
			document.querySelector("#" + pid + "_style_4eDo").innerHTML = style;
		}
		
		let avatar = document.querySelector("#" + pid + " > div > div.post-author > ul > li.pa-avatar.item2 > img");
		let avatar_new = document.querySelector("#" + pid + "_avatar_4eDo").value;
		if(avatar_new != '') avatar.src = avatar_new;
		
		
		let emoji = document.querySelector("#" + pid + " > div > div.post-author > ul > li.pa-fld6 > img");
		let emoji_new = document.querySelector("#" + pid + "_emoji_4eDo").value;
		if(emoji_new != '') emoji.src = emoji_new;
		
		
		let lz = document.querySelector("#" + pid + " > div > div.post-author > ul > li.pa-fld2 > bio");
		let lz_new = document.querySelector("#" + pid + "_lz_4eDo").value;
		if(lz_new != '') lz.innerHTML = lz_new;
		
		
		let sign = document.querySelector("#" + pid + "-content > dl");
		let signContent = document.querySelector("#" + pid + "-content > dl > dd > p");
		let signContent_new = document.querySelector("#" + pid + "_subscription_4eDo").value;
		if(signContent_new != '') signContent.innerHTML = signContent_new;
	}

console.log("~ init customizerPlugin ~");

});
