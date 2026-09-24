(function() {
	const CARD_TEMPLATE = (data) => {
		const head = `
			<p>
				<span class="quest-status status-${data.status}"></span>
				<span><strong>${data.title}</strong></span>
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
			.filter(c => filter === 'all' || c.to.split(' ').includes(filter))
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
