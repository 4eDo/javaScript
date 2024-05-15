var tasksSrc = "https://4edo.github.io/javaScript/progress/Mylo/tasks.json";
var barsSrc = "https://4edo.github.io/javaScript/progress/Mylo/bars.json";
var doneSrc = "https://4edo.github.io/javaScript/progress/Mylo/done.json";

var tasks;
var doneList;
var bars;

const clone = `<span class="material-symbols-outlined" title="СПЁРТЫХ КЛОНОВ">
settings_accessibility
</span>`;

async function loadAll() {
	const responseT = await fetch(tasksSrc);
	tasks = await responseT.json();
	// console.log(tasks);

	const responseB = await fetch(barsSrc);
	bars = await responseB.json();
	// console.log(bars);

	const responseD = await fetch(doneSrc);
	doneList = await responseD.json();
	// console.log(doneList);

	initDoneList();
	initTasksList();
	initBarsList();

	return true;
}
loadAll();

var root = document.documentElement;
// Get the computed styles of the root element
var style = getComputedStyle(root);
// Get the value of the --color-font-general variable
var barWidth = style.getPropertyValue("--barWidth").replace("px", "");

function initBarsList() {
	const BAR_TEMPLATE = `<div class="pbar">
	<div><span class="name"></span></div>
	<div class="descr">descr</div>
	<div class="status">${clone}<span class="currProgress">0</span> из <span class="needProgress">0</span> </div>
	<div class="barRow"></div>
	<div class="scrollRow"></div>
</div>`;
	var barsDiv = document.querySelector("#barsDiv");
	for (let i = 0; i < bars.length; i++) {
		let bar = document.createElement("div");
		let barId = "bar_" + i;
		bar.id = barId;
		bar.innerHTML = BAR_TEMPLATE;
		barsDiv.appendChild(bar);
		document.querySelector("#" + barId + " .name").innerHTML = bars[i].name;
		document.querySelector("#" + barId + " .descr").innerHTML = bars[i].descr;
		document.querySelector("#" + barId + " .currProgress").innerHTML =
			bars[i].progress;
		document.querySelector("#" + barId + " .needProgress").innerHTML =
			bars[i].size;
		document.querySelector("#" + barId + " .scrollRow").style.width =
			(barWidth / bars[i].size) * bars[i].progress + "px";

		let option = document.createElement("option");
		option.setAttribute("value", bars[i].key);
		option.appendChild(document.createTextNode(bars[i].name));
		selBar.appendChild(option);
	}
}

function initTasksList() {
	const TASK_TEMPLATE = `<div class="task">
	<div class="tName"></div>
	<div class="tDescr"></div>
	<div><b>Награда:</b> <span class="tPoints"></span>${clone}</div>
	<div><b>Выполнено:</b> <span class="tStat">0</span> раз(а).</div>
</div>`;
	var taskList = document.querySelector("#taskList");
	for (let i = 0; i < tasks.length; i++) {
		let task = document.createElement("div");
		let taskId = "task_" + i;
		task.id = taskId;
		task.innerHTML = TASK_TEMPLATE;
		taskList.appendChild(task);
		document.querySelector("#" + taskId + " .tName").innerHTML = tasks[i].ruName;
		document.querySelector("#" + taskId + " .tDescr").innerHTML =
			tasks[i].description;
		document.querySelector("#" + taskId + " .tStat").innerHTML = tasks[i].done;
		document.querySelector("#" + taskId + " .tPoints").innerHTML =
			tasks[i].points;
		let option = document.createElement("option");
		option.setAttribute("value", tasks[i].id);
		option.appendChild(document.createTextNode(tasks[i].ruName));
		selTask.appendChild(option);
	}
}

function initDoneList() {
	const DONE_TEMPLATE = `
	<div class="doneItem">
		<div class="taskName"></div>
		<div class="date"></div>	
		<div><b>Награда:</b> <span class="getPoints"></span>${clone}</div>	
	</div>
	`;
	for (let i = 0; i < doneList.length; i++) {
		let taskId = findIdByKey(tasks, "id", doneList[i].taskCode);
		let barId = findIdByKey(bars, "key", doneList[i].forBar);

		if (taskId != -1 && barId != -1) {
			tasks[taskId]["done"] = Number(tasks[taskId]["done"]) + 1;
			bars[barId]["progress"] =
				Number(bars[barId]["progress"]) + Number(tasks[taskId]["points"]);

			let doneT = document.createElement("div");
			let doneId = "taskDone_" + i;
			doneT.id = doneId;
			doneT.innerHTML = DONE_TEMPLATE;
			doneTList.appendChild(doneT);
			document.querySelector("#" + doneId + " .taskName").innerHTML =
				tasks[taskId]["ruName"];
			document.querySelector("#" + doneId + " .date").innerHTML =
				doneList[i]["date"];
			document.querySelector("#" + doneId + " .getPoints").innerHTML =
				tasks[taskId]["points"];
		}
	}
}

function showTab(tabName) {
	var tabs = document.getElementsByClassName("tab-content");
	for (var i = 0; i < tabs.length; i++) {
		tabs[i].style.display = "none";
	}
	document.getElementById(tabName).style.display = "block";
}

function findIdByKey(collection, field, need) {
	for (let i = 0; i < collection.length; i++) {
		if (collection[i][field] == need) {
			return i;
		}
	}
	return -1;
}

function getCode() {
	const currentDate = new Date();
	const year = currentDate.getFullYear();
	const month = String(currentDate.getMonth() + 1).padStart(2, "0");
	const day = String(currentDate.getDate()).padStart(2, "0");
	const hours = String(currentDate.getHours()).padStart(2, "0");
	const minutes = String(currentDate.getMinutes()).padStart(2, "0");

	const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
	let taskId = selTask.value;
	let barId = selBar.value;
	resultCode.value =
		`,
	{
		"taskCode": "` +
		taskId +
		`",
		"date": "` +
		formattedDate +
		`",
		"forBar": "` +
		barId +
		`"
	}`;
}

// Copies a string to the clipboard. Must be called from within an event handler such as click.
// May return false if it failed, but this is not always
// possible. Browser support for Chrome 43+, Firefox 42+, Edge and IE 10+.
// No Safari support, as of (Nov. 2015). Returns false.
// IE: The clipboard feature may be disabled by an adminstrator. By default a prompt is
// shown the first time the clipboard is used (per session).
function copyToClipboard(text) {
	if (window.clipboardData && window.clipboardData.setData) {
		// IE specific code path to prevent textarea being shown while dialog is visible.
		return clipboardData.setData("Text", text);
	} else if (
		document.queryCommandSupported &&
		document.queryCommandSupported("copy")
	) {
		var textarea = document.createElement("textarea");
		textarea.textContent = text;
		textarea.style.position = "fixed"; // Prevent scrolling to bottom of page in MS Edge.
		document.body.appendChild(textarea);
		textarea.select();
		try {
			return document.execCommand("copy"); // Security exception may be thrown by some browsers.
		} catch (ex) {
			console.warn("Copy to clipboard failed.", ex);
			return false;
		} finally {
			document.body.removeChild(textarea);
		}
	}
}

function copyCode() {
	getCode();
	var result = copyToClipboard(resultCode.value);
	console.log("copied?", result);
}
