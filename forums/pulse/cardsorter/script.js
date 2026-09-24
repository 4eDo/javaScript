(function() {
	const FR = {
		al: 'Альянс',
		sv: 'Свора',
		mt: 'Миротворцы',
		free: 'Одиночки'
	};

	const ICON = (key) => `<span class="fr ${key}" title="${FR[key] || key}"></span>`;

	const splitKeys = (str) => (str || '').split(/\s+/).filter(Boolean);

	const CARD_TEMPLATE = (data) => {
		const fromKeys = splitKeys(data.from);
		const toKeys   = splitKeys(data.to);

		const allKeys  = Array.from(new Set([...fromKeys, ...toKeys]));
		const same     = fromKeys.length === 1
			&& toKeys.length === 1
			&& fromKeys[0] === toKeys[0];

		let icons = '';
		if (same) {
			icons = ICON(fromKeys[0]);
		} else {
			const fromHtml = fromKeys.map(ICON).join(' ');
			const toHtml   = toKeys.map(ICON).join(' ');
			icons = `${fromHtml}${fromHtml && toHtml ? ' &rarr; ' : ''}${toHtml}`;
		}

		const head = `
			<p>
				<span class="quest-status status-${data.status}"></span>
				<span><strong>${data.title}</strong></span>
				<span style="float:right">${icons}</span>
			</p>
		`;

		const body = `
			<p>
				${data.descr}
				<br><strong>Дата:</strong> ${data.date}
			</p>
		`;

		if (data.status === 'wip') {
			return `
				${head}
				<div class="quote-box spoiler-box">
					<div onclick="$(this).toggleClass('visible'); $(this).next().toggleClass('visible');" class="">
						Занято за ${data.users || ''}${data.episode ? `: ${data.episode}` : ''}
					</div>
					<blockquote class="">
						${body}
					</blockquote>
				</div>
				<hr>
			`;
		}

		return `
			${head}
			${body}
			<hr>
		`;
	};

	const source = document.querySelector('.cards-source');
	if (!source) return;

	const cards = Array.from(source.querySelectorAll('.card')).map(card => ({
		status: card.querySelector('wstatus')?.textContent.trim() || 'open',
		users: card.querySelector('wusers')?.textContent.trim() || '',
		episode: card.querySelector('wepisode')?.innerHTML.trim() || '',
		from: card.querySelector('wfrom')?.textContent.trim() || '',
		to: card.querySelector('wto')?.textContent.trim() || '',
		title: card.querySelector('wtitle')?.textContent.trim() || '',
		descr: card.querySelector('wdescr')?.textContent.trim() || '',
		date: card.querySelector('wdate')?.textContent.trim() || ''
	}));

	const list = document.querySelector('.quests-list');
	const buttons = document.querySelectorAll('.quests-filters button');

	function render(filter = 'all') {
		list.innerHTML = '';
		cards
			.filter(c => filter === 'all' || c.to.split(/\s+/).includes(filter))
			.forEach(c => {
				list.insertAdjacentHTML('beforeend', CARD_TEMPLATE(c));
			});
	}

	buttons.forEach(btn => {
		btn.addEventListener('click', () => {
			buttons.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			render(btn.dataset.faction);
		});
	});

	render('all');
})();
