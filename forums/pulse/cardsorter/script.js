	const CARD_TEMPLATE = (data) => {
		const icons = buildIcons(data);
		const ep    = episode(data);
		const body  = `
			<p>${data.descr}</p>
			${addons(data)}
		`;

		// Обычный заголовок (open / wip) — оставляем как было
		const head = `
			<p>
				<span class="quest-status status-${data.status}"></span>
				<span><strong>${data.title}</strong></span>
				<span class="icons">${icons}</span>
			</p>
		`;

		if (isArchive(data)) {
			const stateLabel = data.status === 'done' ? 'Выполнено' : 'Провалено';

			// Заголовок архива: две колонки — слева инфо, справа иконки
			const archiveHead = `
				<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1em;">
					<div style="flex:1 1 auto; min-width:0;">
						<p>
							<span class="quest-status status-${data.status}"></span>
							<span><strong>${data.title}</strong></span>
						</p>
						<p style="font-size: smaller;">
							<strong>[ ${stateLabel}${data.users ? ` ${data.users}` : ''} ]</strong>${ep ? `<br>Эпизод: ${ep}` : ''}
						</p>
					</div>
					<div class="icons" style="flex:0 0 auto;">${icons}</div>
				</div>
			`;

			return `
				<div class="quote-box spoiler-box">
					<div onclick="$(this).toggleClass('visible'); $(this).next().toggleClass('visible');" class="">
						${archiveHead}
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
