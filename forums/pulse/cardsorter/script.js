(function() {
	const FR = {
		al: 'Альянс',
		sv: 'Свора',
		mt: 'Миротворцы',
		free: 'Одиночки'
	};

	const ICON = (key) => `<span class="fr ${key}" title="${FR[key] || key}"></span>`;

	const splitKeys = (str) => (str || '').split(/\s+/).filter(Boolean);

	const names = (str) => splitKeys(str)
		.map(k => FR[k] || k)
		.join(', ');

	const addons = (data) => {
		let rows = '';
		if (data.date)  rows += `<p><strong>Дата:</strong> ${data.date}</p>`;
		if (data.bonus) rows += `<p><strong>Награда:</strong> ${data.bonus}</p>`;
		if (data.users) rows += `<p><strong>Участники:</strong> ${data.users}</p>`;
		if (data.from)  rows += `<p><strong>От кого:</strong> ${names(data.from)}</p>`;
		if (data.to)    rows += `<p><strong>Для кого:</strong> ${names(data.to)}</p>`;
		return rows;
	};

	const CARD_TEMPLATE = (data) => {
		const fromKeys = splitKeys(data.from);
		const toKeys   = splitKeys(data.to);

		let icons = '';
		if (fromKeys.length && toKeys.length) {
			const same = fromKeys.length === 1
				&& toKeys.length === 1
				&& fromKeys[0] === toKeys[0];

			if (same) {
				icons = ICON(fromKeys[0]);
			} else {
				const fromHtml = fromKeys.map(ICON).join(' ');
				const toHtml   = toKeys.map(ICON).join(' ');
				icons = `${fromHtml} &rarr; ${toHtml}`;
			}
		} else if (fromKeys.length) {
			icons = fromKeys.map(ICON).join(' ');
		} else if (toKeys.length) {
			icons = toKeys.map(ICON).join(' ');
		}

		const head = `
			<p>
				<span class="quest-status status-${data.status}"></span>
				<span><strong>${data.title}</strong></span>
				<span class="icons">${icons}</span>
			</p>
		`;

		const body = `
			<p>${data.descr}</p>
			${addons(data)}
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
		date: card.querySelector('wdate')?.textContent.trim() || '',
		bonus: card.querySelector('wbonus')?.textContent.trim() || ''
	}));

	const list = document.querySelector('.quests-list');
	const buttons = document.querySelectorAll('.quests-filters button');

	function render(filter = 'all') {
		list.innerHTML = '';
		cards
			.filter(c => {
				if (filter === 'all') return true;
				const keys = splitKeys(c.to);
				return keys.length ? keys.includes(filter) : splitKeys(c.from).includes(filter);
			})
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
