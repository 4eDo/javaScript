(function() {
	const FR = {
		al: 'Альянс',
		sv: 'Свора',
		mt: 'Миротворцы',
		free: 'Одиночки'
	};

	const esc = (s) => String(s).replace(/"/g, '&quot;');

	const ICON = (key) => `<span class="fr ${key}" title="${esc(FR[key] || key)}"></span>`;

	const splitKeys = (str) => (str || '').split(/\s+/).filter(Boolean);

	const names = (str) => splitKeys(str)
		.map(k => FR[k] || k)
		.join(', ');

	const episode = (data) => {
		if (!data.weplink && !data.weptitle) return '';
		if (data.weplink && data.weptitle) {
			return `<a href="${data.weplink}">${data.weptitle}</a>`;
		}
		return data.weplink || data.weptitle;
	};

	const isArchive = (data) => data.status === 'done' || data.status === 'fail';
	const isActive  = (data) => data.status === 'open' || data.status === 'wip';

	const addons = (data) => {
		let rows = '';
		if (data.date)   rows += `<p><strong>Дата:</strong> ${data.date}</p>`;
		if (data.bonus)  rows += `<p><strong>Награда:</strong> ${data.bonus}</p>`;
		if (data.result) rows += `<p><strong>Итог:</strong> ${data.result}</p>`;
		if (data.users)  rows += `<p><strong>Участники:</strong> ${data.users}</p>`;
		if (data.from)   rows += `<p><strong>От кого:</strong> ${names(data.from)}</p>`;
		if (data.to)     rows += `<p><strong>Для кого:</strong> ${names(data.to)}</p>`;
		return rows;
	};

	const buildIcons = (data) => {
		const fromKeys = splitKeys(data.from);
		const toKeys   = splitKeys(data.to);

		if (fromKeys.length && toKeys.length) {
			const same = fromKeys.length === 1
				&& toKeys.length === 1
				&& fromKeys[0] === toKeys[0];

			if (same) return ICON(fromKeys[0]);

			return `${fromKeys.map(ICON).join(' ')} &rarr; ${toKeys.map(ICON).join(' ')}`;
		}
		if (fromKeys.length) return fromKeys.map(ICON).join(' ');
		if (toKeys.length)   return toKeys.map(ICON).join(' ');
		return '';
	};

	const CARD_TEMPLATE = (data) => {
		const icons = buildIcons(data);
		const ep    = episode(data);
		const body  = `
			<p>${data.descr}</p>
			${addons(data)}
		`;

		// Заголовок карточки (иконка + название + иконки фракций)
		const head = `
			<p>
				<span class="quest-status status-${data.status}"></span>
				<span><strong>${data.title}</strong></span>
				<span class="icons">${icons}</span>
			</p>
		`;

		if (isArchive(data)) {
			// Для архива заголовок переносится внутрь спойлера, первой строкой.
			const stateLabel = data.status === 'done' ? 'Выполнено' : 'Провалено';
			return `
				<div class="quote-box spoiler-box">
					<div onclick="$(this).toggleClass('visible'); $(this).next().toggleClass('visible');" class="">
						${head}
						<p style="font-size: smaller;"><strong>[ ${stateLabel}${data.users ? ` ${data.users}` : ''}</strong>${ep ? `<br>Эпизод: ${ep}` : ''} ]</p>
					</div>
					<blockquote class="">
						${body}
					</blockquote>
				</div>
				<hr>
			`;
		}

		if (data.status === 'wip') {
			return `
				${head}
				<div class="quote-box spoiler-box">
					<div onclick="$(this).toggleClass('visible'); $(this).next().toggleClass('visible');" class="">
						Занято за ${data.users || ''}${ep ? `: ${ep}` : ''}
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
		status:   card.querySelector('wstatus')?.textContent.trim() || 'open',
		users:    card.querySelector('wusers')?.textContent.trim() || '',
		weplink:  card.querySelector('weplink')?.textContent.trim() || '',
		weptitle: card.querySelector('weptitle')?.textContent.trim() || '',
		from:     card.querySelector('wfrom')?.textContent.trim() || '',
		to:       card.querySelector('wto')?.textContent.trim() || '',
		title:    card.querySelector('wtitle')?.textContent.trim() || '',
		descr:    card.querySelector('wdescr')?.textContent.trim() || '',
		date:     card.querySelector('wdate')?.textContent.trim() || '',
		bonus:    card.querySelector('wbonus')?.textContent.trim() || '',
		result:   card.querySelector('wresult')?.textContent.trim() || ''
	}));

	const list = document.querySelector('.quests-list');
	const factionButtons = document.querySelectorAll('.quests-filters:not(.quests-filters--state) button');
	const stateButtons   = document.querySelectorAll('.quests-filters--state button');

	let currentFaction = 'all';
	let currentState   = 'active';

	function render() {
		list.innerHTML = '';
		cards
			.filter(c => {
				// фильтр по статусу (актуальные / архив)
				if (currentState === 'active' && !isActive(c)) return false;
				if (currentState === 'archive' && !isArchive(c)) return false;

				// фильтр по фракции
				if (currentFaction === 'all') return true;
				const keys = splitKeys(c.to);
				return keys.length ? keys.includes(currentFaction) : splitKeys(c.from).includes(currentFaction);
			})
			.forEach(c => {
				list.insertAdjacentHTML('beforeend', CARD_TEMPLATE(c));
			});
	}

	factionButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			factionButtons.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			currentFaction = btn.dataset.faction;
			render();
		});
	});

	stateButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			stateButtons.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			currentState = btn.dataset.state;
			render();
		});
	});

	render();
})();
