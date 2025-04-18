// ==UserScript==
// @name         ТЕСТ КАСТОМИЗАЦИИ
// @version      1.1
// @description  Скрипт для теста кастомизации на noStressCross
// @namespace    http://tampermonkey.net/
// @author       4eDo (https://github.com/4eDo)
// @match        *://karma.f-rpg.me/*
// ==/UserScript==
$(function() {
	const BODY_TEMPLATE = `
	<table>
	  <tr>
		<td width="150px;">Шапка профиля</td>
		<td><textarea id="{{pid}}_top-img_4eDo" style="width: 390px; height: 30px;">{{top-img}}</textarea></td>
	  </tr>
	  <tr>
		<td>Аватар</td>
		<td><textarea id="{{pid}}_avatar_4eDo" style="width: 390px; height: 30px;">{{avatar}}</textarea></td>
	  </tr>
	  <tr>
		<td>Плашка</td>
		<td><textarea id="{{pid}}_plate_4eDo" style="width: 390px; height: 90px;">{{plate}}</textarea></td>
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
			let paFld2Selector = "#" + pid + ' li.pa-fld2';

		  if ($("#" + pid + ' li.pa-fld5').length === 0) {
			$(paFld2Selector).after('<li class="pa-fld5"><img src="{{src}}" class="plashka"><icnk><img src="{{EMOJI_SRC}}"></icnk><wrds style="color: #ffffff;">{{SOME_TEXT}}</wrds></li>');
		  }

		  if ($("#" + pid + ' li.pa-fld6').length === 0) {
			$(paFld2Selector).after('<li class="pa-fld6"><img src="" class="igrokFon"></li>');
		  }
		  
			let topImg = document.querySelector("#" + pid + " .igrokFon");
			let avatar = document.querySelector("#" + pid + " .pa-avatar.item2 > img");
			
			let plate = document.querySelector("#" + pid + " .pa-fld5");
			let lz = document.querySelector("#" + pid + " .pa-fld2");
			let sign = document.querySelector("#" + pid + "-content > dl");
			let signContent = document.querySelector("#" + pid + "-content > dl > dd > p");
			let temp = BODY_TEMPLATE.replaceAll("{{pid}}", pid)
			.replaceAll("{{top-img}}", topImg ? topImg.src : "")
			.replaceAll("{{avatar}}", avatar ? avatar.src : "")
			.replaceAll("{{plate}}", plate ? plate.innerHTML : "")
			.replaceAll("{{lz}}", lz ? lz.innerHTML  : "")
			.replaceAll("{{subscription}}", sign ? signContent.innerHTML  : "");
			temp += sign ? sign.outerHTML  : "";
			document.querySelector("#" + pid + "-content").innerHTML = temp;
			
			document.querySelector("#" + pid + "_look_4eDo").addEventListener('click', function () {
				look_4eDo(pid, element.dataset.userId);
			});
		});
	}

	function look_4eDo(pid, uid){
		console.log("look...");
		let topImg = document.querySelector("#" + pid + " .igrokFon");
		let topImg_new = document.querySelector("#" + pid + "_top-img_4eDo").value;
		if(topImg_new != '') {
			topImg.src = topImg_new;
		}
		
		let avatar = document.querySelector("#" + pid + " .pa-avatar > img");
		let avatar_new = document.querySelector("#" + pid + "_avatar_4eDo").value;
		if(avatar_new != '') avatar.src = avatar_new;
		
		
		let plate = document.querySelector("#" + pid + " .pa-fld5");
		let plate_new = document.querySelector("#" + pid + "_plate_4eDo").value;
		if(plate_new != '') plate.innerHTML = plate_new;
		
		
		let lz = document.querySelector("#" + pid + " .pa-fld2");
		let lz_new = document.querySelector("#" + pid + "_lz_4eDo").value;
		if(lz_new != '') lz.innerHTML = lz_new;
		
		
		let sign = document.querySelector("#" + pid + "-content > dl");
		let signContent = document.querySelector("#" + pid + "-content > dl > dd > p");
		let signContent_new = document.querySelector("#" + pid + "_subscription_4eDo").value;
		if(signContent_new != '') signContent.innerHTML = signContent_new;
	}

console.log("~ init customizerPlugin ~");

});
