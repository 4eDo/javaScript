function mozillaQuote(username, messageId) {
    var selection = window.getSelection().toString().trim();
    var message = document.getElementById("p" + messageId + "-content").innerHTML;

    if (selection === "") {
        // console.log(message);
    } else {
        var range = window.getSelection().getRangeAt(0);
        var container = document.createElement("div");
        container.appendChild(range.cloneContents());
        var selectedHtml = container.innerHTML;

        // Check if the selected text is a complete HTML fragment
        if (!selectedHtml.startsWith("<") || !selectedHtml.endsWith(">")) {
            selectedHtml = "<span>" + selectedHtml + "</span>";
        }

        message = selectedHtml;
    }

	var cleanedHtmlString = message.replace(/<div class="quote-box answer-box">[\s\S]*?<\/div>/g, "");
	cleanedHtmlString = message.replace(/<dl class="post-sig">[\s\S]*?<\/dl>/g, "");

	console.log(cleanedHtmlString);

	message = cleanedHtmlString
		.replace(/<br([\/ ]){0,2}>/gi, "\n")
		.replace(/\t/g, "")
		.replace(/\r\n/g, "\n")
		.replace(/\n\n\n/g, "\n\n");
	//console.log(htmlToBBmozilla(message));
	insert(  insert('[quote="' + username + '"]' + $.trim(htmlToBBmozilla(message)) + "[/quote]\n"));
}

function htmlToBBmozilla(htmlString) {
    // Заменяем теги на соответствующие BB-коды
    htmlString = htmlString.replace(/<b>([\s\S]*?)<\/b>/g, '[b]$1[/b]');
    htmlString = htmlString.replace(/<strong>([\s\S]*?)<\/strong>/g, '[b]$1[/b]');
    htmlString = htmlString.replace(/<u>([\s\S]*?)<\/u>/g, '[u]$1[/u]');
    htmlString = htmlString.replace(/<i>([\s\S]*?)<\/i>/g, '[i]$1[/i]');
    htmlString = htmlString.replace(/<s>([\s\S]*?)<\/s>/g, '[s]$1[/s]');
    htmlString = htmlString.replace(/<img src="([\s\S]*?)"\/>/g, '[img]$1[/img]');
    // Заменяем теги [u]text[/u]
    htmlString = htmlString.replace(/<em class="bbuline">([^<]+)<\/em>/g, '[u]$1[/u]');

    // Заменяем теги [i]text[/i]
   htmlString = htmlString.replace(/<span style="font-style: italic">([^<]+)<\/span>/g, '[i]$1[/i]');

    // Заменяем теги [s]text[/s]
    htmlString = htmlString.replace(/<del>([^<]+)<\/del>/g, '[s]$1[/s]');

    // Заменяем теги [spoiler="заголовок"]текст[/spoiler]
    htmlString = htmlString.replace(/<div class="quote-box spoiler-box text-box"><div onclick="(.+)">([^<]+)<\/div><blockquote><p>([^<]+)<\/p><\/blockquote><\/div>/g, '[spoiler="$2"]$3[/spoiler]')

    // Заменяем теги [img]ссылка_на_картинку[/img]
    htmlString = htmlString.replace(/<img class="postimg" loading="lazy" src="([^"]+)" alt="([^"]+)"\/?>/g, '[img]$1[/img]');

    // Преобразуем тег <a> с атрибутами href и title в [url=ссылка]название[/url]
    htmlString = htmlString.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '[url=$1]$2[/url]');
	
    htmlString = htmlString.replace(/<\/p><p>/g, '\n');
    htmlString = htmlString.replace(/<p>/g, '');
    htmlString = htmlString.replace(/<\/p>/g, '');
    htmlString = htmlString.replace(/<[^>]+>/g, '');


    return htmlString;
}

if($.browser.mozilla) {
	// Переопределение действия кнопки "цитировать"
	quote = function(u, m){
        mozillaQuote(u, m);
    }
}
