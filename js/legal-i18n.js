/* Privacy & Terms copy. Used by privacy.html / terms.html via ?lang= */
(function (global) {
  const LANGS = ['uk', 'pl', 'en', 'ru', 'es', 'de', 'it', 'fr', 'pt'];

  function q(theme, lang) {
    return '?theme=' + encodeURIComponent(theme || 'dark') + '&lang=' + encodeURIComponent(lang || 'en');
  }

  const privacy = {
    en: {
      title: 'TEMPO — Privacy',
      h1: 'TEMPO Privacy',
      updated: 'Updated: 26 October 2026',
      blocks: [
        { t: 'p', html: 'TEMPO is a sideline match diary for a parent and a separate coach mode. There are no ads and no third-party analytics. Some data stays on the phone; some goes to your account only if you sign in.' },
        { t: 'h2', text: 'What we store' },
        { t: 'ul', items: [
          'Player profile: name, team, positions, photo and card background. A parent or coach can fill this in, including when the player is a child. The app is meant for parents and coaches.',
          'Email or Google account if you sign in.',
          'Matches, ratings, comments, season and settings.',
          'For a coach: academy, teams, roster, team matches, parent invites, chat and replies, and whether a child will attend training or a match.'
        ]},
        { t: 'h2', text: 'Where it lives' },
        { t: 'ul', items: [
          '<strong>Free personal season</strong> stays on this phone. Signing in alone does not upload it to the cloud.',
          '<strong>“On this phone” backup</strong> is a season file under Downloads / TEMPO. The file includes the photo if one is on the card.',
          '<strong>TEMPO Pro</strong>, when signed in, syncs the personal season between phones. That cloud copy includes the photo with the matches.',
          '<strong>Coach and invited parent</strong>, when signed in, store the team, invites, chat and schedule in the account cloud — separate from the personal sideline season.',
          'A match card you save to the gallery goes to Pictures/Tempo on the phone.'
        ]},
        { t: 'p', html: 'Photos are not published separately and are not sold. They travel only inside your backup or account cloud.' },
        { t: 'h2', text: 'What we never receive' },
        { t: 'p', html: 'TEMPO Pro and TEMPO Coach subscriptions are billed by Google Play and the App Store. We do not get the card number — only whether a subscription is active. Cancel in Google Play or Apple subscriptions.' },
        { t: 'h2', text: 'Sign-out and deletion' },
        { t: 'p', html: 'In Settings → Sign out, email is disconnected on this phone. The cloud stays.' },
        { t: 'p', html: '“Clear data on this phone” erases the season only on this device and does not touch the cloud.' },
        { t: 'p', html: '“Delete account” at the bottom of Settings removes that sign-in’s cloud: Pro season, coach teams and parent invites. A season that lives only on the phone stays. If the button fails, email <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20delete%20account">support</a> from the address you used to sign in.' },
        { t: 'h2', text: 'Android permissions' },
        { t: 'ul', items: [
          '<strong>Notifications</strong> — a new chat message arrives once via push. A training or match reminder fires at the time you turned on.',
          '<strong>Camera</strong> — a shot for the player photo or background, only when you tap.',
          '<strong>Gallery / photos</strong> — pick an existing photo and save a match card to Pictures/Tempo.',
          '<strong>Internet</strong> — sign-in, coach, chat and Pro cloud. The match diary on the phone works offline.'
        ]},
        { t: 'h2', text: 'Contact' },
        { t: 'p', html: 'Support: <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">email</a> · <a href="https://github.com/IhorMich/ffk/issues">GitHub Issues</a>.' }
      ]
    },
    ru: {
      title: 'TEMPO — конфиденциальность',
      h1: 'Конфиденциальность TEMPO',
      updated: 'Обновлено: 26 октября 2026',
      blocks: [
        { t: 'p', html: 'TEMPO — дневник футбольного матча для родителя у бровки и отдельный режим тренера. Рекламы и сторонней аналитики нет. Часть данных остаётся на телефоне, часть уходит в аккаунт, если вы сами вошли.' },
        { t: 'h2', text: 'Что хранится' },
        { t: 'ul', items: [
          'профиль игрока: имя, команда, позиции, фото и фон карточки. Его может заполнять родитель или тренер, в том числе если игрок — ребёнок. Само приложение рассчитано на родителя и тренера;',
          'почта или аккаунт Google, если вы вошли;',
          'матчи, оценки, комментарии, сезон и настройки;',
          'у тренера: академия, команды, состав, командные матчи, приглашения родителей, чат и ответы, будет ли ребёнок на тренировке или игре.'
        ]},
        { t: 'h2', text: 'Где это лежит' },
        { t: 'ul', items: [
          '<strong>Бесплатный личный сезон</strong> остаётся на этом телефоне. Вход в аккаунт сам по себе его в облако не отправляет.',
          '<strong>Копия «На телефон»</strong> — файл сезона в «Загрузки / TEMPO». В файл входит и фото, если оно есть на карточке.',
          '<strong>TEMPO Pro</strong> при входе синхронизирует личный сезон между телефонами. В эту облачную копию фото входит вместе с матчами.',
          '<strong>Тренер и приглашённый родитель</strong> при входе хранят команду, приглашения, чат и расписание в облаке аккаунта. Это отдельно от личного сезона у бровки.',
          'Карточка матча, которую вы сохраняете в галерею, лежит в «Pictures/Tempo» на телефоне.'
        ]},
        { t: 'p', html: 'Фото не публикуется отдельно и не продаётся. Оно едет только внутри вашей копии или облака аккаунта.' },
        { t: 'h2', text: 'Куда данные не уходят' },
        { t: 'p', html: 'Оплату подписок TEMPO Pro и TEMPO Coach принимают Google Play и App Store. Номер карты нам не передаётся. Мы видим только, что подписка активна. Отмена — в подписках Google Play или Apple.' },
        { t: 'h2', text: 'Выход и удаление' },
        { t: 'p', html: 'В Настройках → «Выйти» почта отключается на этом телефоне. Облако при этом остаётся.' },
        { t: 'p', html: '«Очистить данные на телефоне» стирает сезон только на этом устройстве и не трогает облако.' },
        { t: 'p', html: '«Удалить аккаунт» в самом низу Настроек стирает облако этого входа: сезон Pro, команду тренера и приглашения родителей. Сезон, который лежит только на телефоне, остаётся. Если кнопка не срабатывает, напишите на <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20delete%20account">email поддержки</a> с адресом, которым входили.' },
        { t: 'h2', text: 'Разрешения Android' },
        { t: 'ul', items: [
          '<strong>Уведомления</strong> — новое сообщение чата приходит один раз, через push. Напоминание о тренировке или игре срабатывает в выбранное время, если вы его включили.',
          '<strong>Камера</strong> — снимок для фото игрока или фона, только когда вы сами нажимаете.',
          '<strong>Галерея / фото</strong> — выбрать готовый снимок и сохранить карточку матча в «Pictures/Tempo».',
          '<strong>Интернет</strong> — вход, тренер, чат и облако Pro. Дневник матчей на телефоне работает офлайн.'
        ]},
        { t: 'h2', text: 'Контакты' },
        { t: 'p', html: 'Поддержка: <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">email</a> · <a href="https://github.com/IhorMich/ffk/issues">GitHub Issues</a>.' }
      ]
    },
    uk: {
      title: 'TEMPO — конфіденційність',
      h1: 'Конфіденційність TEMPO',
      updated: 'Оновлено: 26 жовтня 2026',
      blocks: [
        { t: 'p', html: 'TEMPO — щоденник футбольного матчу для батька біля бровки та окремий режим тренера. Реклами й сторонньої аналітики немає. Частина даних лишається на телефоні, частина потрапляє в акаунт, лише якщо ви самі увійшли.' },
        { t: 'h2', text: 'Що зберігається' },
        { t: 'ul', items: [
          'профіль гравця: імʼя, команда, позиції, фото і фон картки. Його може заповнювати батько або тренер, зокрема якщо гравець — дитина. Сам застосунок розрахований на батьків і тренера;',
          'пошта або акаунт Google, якщо ви увійшли;',
          'матчі, оцінки, коментарі, сезон і налаштування;',
          'у тренера: академія, команди, склад, командні матчі, запрошення батьків, чат і відповіді, чи буде дитина на тренуванні або грі.'
        ]},
        { t: 'h2', text: 'Де це лежить' },
        { t: 'ul', items: [
          '<strong>Безкоштовний особистий сезон</strong> лишається на цьому телефоні. Вхід в акаунт сам по собі не відправляє його в хмару.',
          '<strong>Копія «На телефон»</strong> — файл сезону в «Завантаження / TEMPO». У файл входить і фото, якщо воно є на картці.',
          '<strong>TEMPO Pro</strong> після входу синхронізує особистий сезон між телефонами. У цю хмарну копію фото входить разом із матчами.',
          '<strong>Тренер і запрошений батько</strong> після входу зберігають команду, запрошення, чат і розклад у хмарі акаунта. Це окремо від особистого сезону біля бровки.',
          'Картка матчу, яку ви зберігаєте в галерею, лежить у «Pictures/Tempo» на телефоні.'
        ]},
        { t: 'p', html: 'Фото не публікується окремо і не продається. Воно їде лише всередині вашої копії або хмари акаунта.' },
        { t: 'h2', text: 'Куди дані не йдуть' },
        { t: 'p', html: 'Оплату підписок TEMPO Pro і TEMPO Coach приймають Google Play та App Store. Номер картки нам не передається. Ми бачимо лише, що підписка активна. Скасування — у підписках Google Play або Apple.' },
        { t: 'h2', text: 'Вихід і видалення' },
        { t: 'p', html: 'У Налаштуваннях → «Вийти» пошта відключається на цьому телефоні. Хмара при цьому лишається.' },
        { t: 'p', html: '«Очистити дані на телефоні» стирає сезон лише на цьому пристрої і не чіпає хмару.' },
        { t: 'p', html: '«Видалити акаунт» внизу Налаштувань стирає хмару цього входу: сезон Pro, команду тренера і запрошення батьків. Сезон, який лежить лише на телефоні, лишається. Якщо кнопка не спрацьовує, напишіть на <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20delete%20account">email підтримки</a> з адресою, якою входили.' },
        { t: 'h2', text: 'Дозволи Android' },
        { t: 'ul', items: [
          '<strong>Сповіщення</strong> — нове повідомлення чату приходить один раз через push. Нагадування про тренування чи гру спрацьовує в обраний час, якщо ви його увімкнули.',
          '<strong>Камера</strong> — знімок для фото гравця або фону, лише коли ви самі натискаєте.',
          '<strong>Галерея / фото</strong> — обрати готовий знімок і зберегти картку матчу в «Pictures/Tempo».',
          '<strong>Інтернет</strong> — вхід, тренер, чат і хмара Pro. Щоденник матчів на телефоні працює офлайн.'
        ]},
        { t: 'h2', text: 'Контакти' },
        { t: 'p', html: 'Підтримка: <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">email</a> · <a href="https://github.com/IhorMich/ffk/issues">GitHub Issues</a>.' }
      ]
    },
    pl: {
      title: 'TEMPO — prywatność',
      h1: 'Prywatność TEMPO',
      updated: 'Zaktualizowano: 26 października 2026',
      blocks: [
        { t: 'p', html: 'TEMPO to dziennik meczowy dla rodzica przy boisku oraz osobny tryb trenera. Bez reklam i zewnętrznej analityki. Część danych zostaje na telefonie, część trafia na konto tylko jeśli sam się zalogujesz.' },
        { t: 'h2', text: 'Co przechowujemy' },
        { t: 'ul', items: [
          'profil zawodnika: imię, drużyna, pozycje, zdjęcie i tło karty. Może go uzupełnić rodzic lub trener, także gdy zawodnik jest dzieckiem. Aplikacja jest przeznaczona dla rodziców i trenerów;',
          'e-mail lub konto Google po zalogowaniu;',
          'mecze, oceny, komentarze, sezon i ustawienia;',
          'u trenera: akademia, zespoły, kadra, mecze drużynowe, zaproszenia rodziców, czat i odpowiedzi, czy dziecko będzie na treningu lub meczu.'
        ]},
        { t: 'h2', text: 'Gdzie to jest' },
        { t: 'ul', items: [
          '<strong>Darmowy sezon osobisty</strong> zostaje na tym telefonie. Samo logowanie nie wysyła go do chmury.',
          '<strong>Kopia „Na telefon”</strong> — plik sezonu w Pobrane / TEMPO. W pliku jest też zdjęcie, jeśli jest na karcie.',
          '<strong>TEMPO Pro</strong> po zalogowaniu synchronizuje sezon osobisty między telefonami. Ta kopia w chmurze zawiera zdjęcie wraz z meczami.',
          '<strong>Trener i zaproszony rodzic</strong> po zalogowaniu trzymają drużynę, zaproszenia, czat i harmonogram w chmurze konta — osobno od sezonu osobistego przy boisku.',
          'Kartę meczu zapisaną do galerii znajdziesz w Pictures/Tempo na telefonie.'
        ]},
        { t: 'p', html: 'Zdjęcia nie są publikowane osobno i nie są sprzedawane. Trafiają tylko do Twojej kopii lub chmury konta.' },
        { t: 'h2', text: 'Czego nie dostajemy' },
        { t: 'p', html: 'Subskrypcje TEMPO Pro i TEMPO Coach rozliczają Google Play i App Store. Numer karty do nas nie trafia — widzimy tylko, czy subskrypcja jest aktywna. Anuluj w subskrypcjach Google Play lub Apple.' },
        { t: 'h2', text: 'Wylogowanie i usuwanie' },
        { t: 'p', html: 'W Ustawieniach → Wyloguj e-mail jest odłączany na tym telefonie. Chmura zostaje.' },
        { t: 'p', html: '„Wyczyść dane na telefonie” kasuje sezon tylko na tym urządzeniu i nie rusza chmury.' },
        { t: 'p', html: '„Usuń konto” na dole Ustawień kasuje chmurę tego logowania: sezon Pro, drużyny trenera i zaproszenia rodziców. Sezon tylko na telefonie zostaje. Jeśli przycisk nie działa, napisz na <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20delete%20account">e-mail wsparcia</a> z adresem, którym się logowałeś.' },
        { t: 'h2', text: 'Uprawnienia Android' },
        { t: 'ul', items: [
          '<strong>Powiadomienia</strong> — nowa wiadomość czatu przychodzi raz przez push. Przypomnienie o treningu lub meczu odpala się o wybranej godzinie.',
          '<strong>Aparat</strong> — zdjęcie zawodnika lub tła, tylko gdy sam naciśniesz.',
          '<strong>Galeria / zdjęcia</strong> — wybór gotowego zdjęcia i zapis karty meczu do Pictures/Tempo.',
          '<strong>Internet</strong> — logowanie, trener, czat i chmura Pro. Dziennik meczów na telefonie działa offline.'
        ]},
        { t: 'h2', text: 'Kontakt' },
        { t: 'p', html: 'Wsparcie: <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">e-mail</a> · <a href="https://github.com/IhorMich/ffk/issues">GitHub Issues</a>.' }
      ]
    },
    es: {
      title: 'TEMPO — privacidad',
      h1: 'Privacidad de TEMPO',
      updated: 'Actualizado: 26 de octubre de 2026',
      blocks: [
        { t: 'p', html: 'TEMPO es un diario de partidos para el padre en la banda y un modo entrenador aparte. Sin anuncios ni analítica de terceros. Parte de los datos queda en el teléfono; otra parte va a la cuenta solo si inicias sesión.' },
        { t: 'h2', text: 'Qué guardamos' },
        { t: 'ul', items: [
          'perfil del jugador: nombre, equipo, posiciones, foto y fondo de la carta. Lo puede completar un padre o un entrenador, también si el jugador es un niño. La app está pensada para padres y entrenadores;',
          'correo o cuenta de Google si inicias sesión;',
          'partidos, valoraciones, comentarios, temporada y ajustes;',
          'para el entrenador: academia, equipos, plantilla, partidos de equipo, invitaciones a padres, chat y respuestas, y si el niño irá al entreno o al partido.'
        ]},
        { t: 'h2', text: 'Dónde está' },
        { t: 'ul', items: [
          '<strong>Temporada personal gratuita</strong> se queda en este teléfono. Iniciar sesión por sí solo no la sube a la nube.',
          '<strong>Copia «Al teléfono»</strong> — archivo de temporada en Descargas / TEMPO. Incluye la foto si está en la carta.',
          '<strong>TEMPO Pro</strong>, con sesión iniciada, sincroniza la temporada personal entre teléfonos. Esa copia en la nube incluye la foto con los partidos.',
          '<strong>Entrenador y padre invitado</strong>, con sesión, guardan equipo, invitaciones, chat y calendario en la nube de la cuenta — aparte de la temporada personal en la banda.',
          'La carta de partido que guardas en la galería va a Pictures/Tempo en el teléfono.'
        ]},
        { t: 'p', html: 'Las fotos no se publican por separado ni se venden. Solo viajan dentro de tu copia o de la nube de la cuenta.' },
        { t: 'h2', text: 'Qué no recibimos' },
        { t: 'p', html: 'Las suscripciones TEMPO Pro y TEMPO Coach las cobran Google Play y App Store. No recibimos el número de tarjeta, solo si la suscripción está activa. Cancela en las suscripciones de Google Play o Apple.' },
        { t: 'h2', text: 'Cerrar sesión y borrar' },
        { t: 'p', html: 'En Ajustes → Cerrar sesión, el correo se desconecta en este teléfono. La nube se mantiene.' },
        { t: 'p', html: '«Borrar datos de este teléfono» borra la temporada solo en este dispositivo y no toca la nube.' },
        { t: 'p', html: '«Eliminar cuenta» al final de Ajustes borra la nube de esa sesión: temporada Pro, equipos del entrenador e invitaciones a padres. La temporada solo en el teléfono permanece. Si el botón falla, escribe a <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20delete%20account">soporte</a> desde el correo con el que entraste.' },
        { t: 'h2', text: 'Permisos de Android' },
        { t: 'ul', items: [
          '<strong>Notificaciones</strong> — un mensaje nuevo del chat llega una vez por push. El recordatorio de entreno o partido suena a la hora que activaste.',
          '<strong>Cámara</strong> — foto del jugador o del fondo, solo cuando tú pulsas.',
          '<strong>Galería / fotos</strong> — elegir una foto y guardar la carta del partido en Pictures/Tempo.',
          '<strong>Internet</strong> — acceso, entrenador, chat y nube Pro. El diario de partidos en el teléfono funciona sin conexión.'
        ]},
        { t: 'h2', text: 'Contacto' },
        { t: 'p', html: 'Soporte: <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">email</a> · <a href="https://github.com/IhorMich/ffk/issues">GitHub Issues</a>.' }
      ]
    },
    de: {
      title: 'TEMPO — Datenschutz',
      h1: 'TEMPO-Datenschutz',
      updated: 'Aktualisiert: 26. Oktober 2026',
      blocks: [
        { t: 'p', html: 'TEMPO ist ein Spieltagebuch für Eltern am Spielfeldrand und ein eigener Trainer-Modus. Keine Werbung, keine Drittanbieter-Analytik. Ein Teil der Daten bleibt auf dem Telefon; ein Teil geht nur bei Anmeldung ins Konto.' },
        { t: 'h2', text: 'Was wir speichern' },
        { t: 'ul', items: [
          'Spielerprofil: Name, Team, Positionen, Foto und Kartenhintergrund. Eltern oder Trainer können es ausfüllen, auch wenn der Spieler ein Kind ist. Die App ist für Eltern und Trainer gedacht;',
          'E-Mail oder Google-Konto nach Anmeldung;',
          'Spiele, Bewertungen, Kommentare, Saison und Einstellungen;',
          'beim Trainer: Akademie, Teams, Kader, Teamspiele, Eltern-Einladungen, Chat und Antworten, ob das Kind zum Training oder Spiel kommt.'
        ]},
        { t: 'h2', text: 'Wo es liegt' },
        { t: 'ul', items: [
          '<strong>Kostenlose persönliche Saison</strong> bleibt auf diesem Telefon. Die Anmeldung allein lädt sie nicht in die Cloud.',
          '<strong>Kopie „Aufs Telefon“</strong> — Saison-Datei unter Downloads / TEMPO. Die Datei enthält das Foto, wenn eines auf der Karte ist.',
          '<strong>TEMPO Pro</strong> synchronisiert nach Anmeldung die persönliche Saison zwischen Telefonen. Diese Cloud-Kopie enthält das Foto mit den Spielen.',
          '<strong>Trainer und eingeladene Eltern</strong> speichern nach Anmeldung Team, Einladungen, Chat und Plan in der Konto-Cloud — getrennt von der persönlichen Sideline-Saison.',
          'Eine Spielkarte, die du in die Galerie speicherst, liegt unter Pictures/Tempo auf dem Telefon.'
        ]},
        { t: 'p', html: 'Fotos werden nicht separat veröffentlicht und nicht verkauft. Sie reisen nur in deiner Kopie oder der Konto-Cloud.' },
        { t: 'h2', text: 'Was wir nie erhalten' },
        { t: 'p', html: 'Abos für TEMPO Pro und TEMPO Coach rechnet Google Play und der App Store ab. Die Kartennummer bekommen wir nicht — nur, ob ein Abo aktiv ist. Kündigung in den Abos von Google Play oder Apple.' },
        { t: 'h2', text: 'Abmelden und Löschen' },
        { t: 'p', html: 'Unter Einstellungen → Abmelden wird die E-Mail auf diesem Telefon getrennt. Die Cloud bleibt.' },
        { t: 'p', html: '„Daten auf diesem Telefon löschen“ löscht die Saison nur auf diesem Gerät und nicht die Cloud.' },
        { t: 'p', html: '„Konto löschen“ unten in den Einstellungen löscht die Cloud dieser Anmeldung: Pro-Saison, Trainer-Teams und Eltern-Einladungen. Eine nur auf dem Telefon liegende Saison bleibt. Wenn der Button fehlschlägt, schreib an <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20delete%20account">Support</a> von der Adresse, mit der du dich angemeldet hast.' },
        { t: 'h2', text: 'Android-Berechtigungen' },
        { t: 'ul', items: [
          '<strong>Benachrichtigungen</strong> — eine neue Chat-Nachricht kommt einmal per Push. Die Erinnerung an Training oder Spiel kommt zur eingestellten Zeit.',
          '<strong>Kamera</strong> — Aufnahme für Spielerfoto oder Hintergrund, nur wenn du tippst.',
          '<strong>Galerie / Fotos</strong> — bestehendes Foto wählen und Spielkarte nach Pictures/Tempo speichern.',
          '<strong>Internet</strong> — Anmeldung, Trainer, Chat und Pro-Cloud. Das Spieltagebuch auf dem Telefon funktioniert offline.'
        ]},
        { t: 'h2', text: 'Kontakt' },
        { t: 'p', html: 'Support: <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">E-Mail</a> · <a href="https://github.com/IhorMich/ffk/issues">GitHub Issues</a>.' }
      ]
    },
    it: {
      title: 'TEMPO — privacy',
      h1: 'Privacy di TEMPO',
      updated: 'Aggiornato: 26 ottobre 2026',
      blocks: [
        { t: 'p', html: 'TEMPO è un diario partite per il genitore a bordo campo e una modalità allenatore separata. Niente pubblicità né analitica di terze parti. Parte dei dati resta sul telefono; parte va sull’account solo se accedi.' },
        { t: 'h2', text: 'Cosa conserviamo' },
        { t: 'ul', items: [
          'profilo giocatore: nome, squadra, posizioni, foto e sfondo della carta. Può compilarlo un genitore o un allenatore, anche se il giocatore è un bambino. L’app è pensata per genitori e allenatori;',
          'email o account Google se accedi;',
          'partite, valutazioni, commenti, stagione e impostazioni;',
          'per l’allenatore: accademia, squadre, rosa, partite di squadra, inviti ai genitori, chat e risposte, e se il bambino andrà all’allenamento o alla partita.'
        ]},
        { t: 'h2', text: 'Dove sta' },
        { t: 'ul', items: [
          '<strong>Stagione personale gratuita</strong> resta su questo telefono. L’accesso da solo non la carica sul cloud.',
          '<strong>Copia «Sul telefono»</strong> — file stagione in Download / TEMPO. Il file include la foto se è sulla carta.',
          '<strong>TEMPO Pro</strong>, con accesso, sincronizza la stagione personale tra telefoni. Quella copia cloud include la foto con le partite.',
          '<strong>Allenatore e genitore invitato</strong>, con accesso, conservano squadra, inviti, chat e calendario nel cloud dell’account — separati dalla stagione personale a bordo campo.',
          'La carta partita salvata in galleria va in Pictures/Tempo sul telefono.'
        ]},
        { t: 'p', html: 'Le foto non vengono pubblicate a parte né vendute. Viaggiano solo dentro la tua copia o il cloud dell’account.' },
        { t: 'h2', text: 'Cosa non riceviamo' },
        { t: 'p', html: 'Gli abbonamenti TEMPO Pro e TEMPO Coach li gestiscono Google Play e App Store. Non riceviamo il numero della carta, solo se l’abbonamento è attivo. Annulla nelle sottoscrizioni Google Play o Apple.' },
        { t: 'h2', text: 'Uscita e cancellazione' },
        { t: 'p', html: 'In Impostazioni → Esci, l’email si scollega su questo telefono. Il cloud resta.' },
        { t: 'p', html: '«Cancella i dati su questo telefono» cancella la stagione solo su questo dispositivo e non tocca il cloud.' },
        { t: 'p', html: '«Elimina account» in fondo alle Impostazioni cancella il cloud di quell’accesso: stagione Pro, squadre allenatore e inviti genitori. La stagione solo sul telefono resta. Se il pulsante non funziona, scrivi a <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20delete%20account">supporto</a> dall’indirizzo con cui hai effettuato l’accesso.' },
        { t: 'h2', text: 'Permessi Android' },
        { t: 'ul', items: [
          '<strong>Notifiche</strong> — un nuovo messaggio chat arriva una volta via push. Il promemoria di allenamento o partita scatta all’ora impostata.',
          '<strong>Fotocamera</strong> — scatto per foto giocatore o sfondo, solo quando tocchi tu.',
          '<strong>Galleria / foto</strong> — scegliere una foto e salvare la carta partita in Pictures/Tempo.',
          '<strong>Internet</strong> — accesso, allenatore, chat e cloud Pro. Il diario partite sul telefono funziona offline.'
        ]},
        { t: 'h2', text: 'Contatti' },
        { t: 'p', html: 'Supporto: <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">email</a> · <a href="https://github.com/IhorMich/ffk/issues">GitHub Issues</a>.' }
      ]
    },
    fr: {
      title: 'TEMPO — confidentialité',
      h1: 'Confidentialité TEMPO',
      updated: 'Mis à jour : 26 octobre 2026',
      blocks: [
        { t: 'p', html: 'TEMPO est un carnet de match pour le parent au bord du terrain et un mode coach séparé. Pas de pubs ni d’analytique tierce. Une partie des données reste sur le téléphone ; une autre va sur le compte seulement si vous vous connectez.' },
        { t: 'h2', text: 'Ce que nous stockons' },
        { t: 'ul', items: [
          'profil joueur : nom, équipe, postes, photo et fond de carte. Un parent ou un coach peut le remplir, y compris si le joueur est un enfant. L’app est destinée aux parents et coachs ;',
          'e-mail ou compte Google si vous vous connectez ;',
          'matchs, notes, commentaires, saison et réglages ;',
          'pour le coach : académie, équipes, effectif, matchs d’équipe, invitations parents, chat et réponses, et si l’enfant ira à l’entraînement ou au match.'
        ]},
        { t: 'h2', text: 'Où ça vit' },
        { t: 'ul', items: [
          '<strong>Saison perso gratuite</strong> reste sur ce téléphone. La connexion seule ne l’envoie pas dans le cloud.',
          '<strong>Copie « Sur le téléphone »</strong> — fichier de saison dans Téléchargements / TEMPO. Le fichier inclut la photo si elle est sur la carte.',
          '<strong>TEMPO Pro</strong>, une fois connecté, synchronise la saison perso entre téléphones. Cette copie cloud inclut la photo avec les matchs.',
          '<strong>Coach et parent invité</strong>, une fois connectés, stockent équipe, invitations, chat et calendrier dans le cloud du compte — séparé de la saison perso au bord du terrain.',
          'La carte de match enregistrée dans la galerie va dans Pictures/Tempo sur le téléphone.'
        ]},
        { t: 'p', html: 'Les photos ne sont pas publiées séparément ni vendues. Elles voyagent seulement dans votre copie ou le cloud du compte.' },
        { t: 'h2', text: 'Ce que nous ne recevons jamais' },
        { t: 'p', html: 'Les abonnements TEMPO Pro et TEMPO Coach sont facturés par Google Play et l’App Store. Nous ne recevons pas le numéro de carte — seulement si l’abonnement est actif. Résiliez dans les abonnements Google Play ou Apple.' },
        { t: 'h2', text: 'Déconnexion et suppression' },
        { t: 'p', html: 'Dans Réglages → Se déconnecter, l’e-mail est déconnecté sur ce téléphone. Le cloud reste.' },
        { t: 'p', html: '« Effacer les données sur ce téléphone » efface la saison seulement sur cet appareil et ne touche pas au cloud.' },
        { t: 'p', html: '« Supprimer le compte » en bas des Réglages efface le cloud de cette connexion : saison Pro, équipes coach et invitations parents. La saison uniquement sur le téléphone reste. Si le bouton échoue, écrivez à <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20delete%20account">le support</a> depuis l’adresse utilisée pour vous connecter.' },
        { t: 'h2', text: 'Autorisations Android' },
        { t: 'ul', items: [
          '<strong>Notifications</strong> — un nouveau message de chat arrive une fois en push. Le rappel d’entraînement ou de match sonne à l’heure choisie.',
          '<strong>Caméra</strong> — photo joueur ou fond, seulement quand vous appuyez.',
          '<strong>Galerie / photos</strong> — choisir une photo et enregistrer la carte de match dans Pictures/Tempo.',
          '<strong>Internet</strong> — connexion, coach, chat et cloud Pro. Le carnet de matchs sur le téléphone fonctionne hors ligne.'
        ]},
        { t: 'h2', text: 'Contact' },
        { t: 'p', html: 'Support : <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">e-mail</a> · <a href="https://github.com/IhorMich/ffk/issues">GitHub Issues</a>.' }
      ]
    },
    pt: {
      title: 'TEMPO — privacidade',
      h1: 'Privacidade TEMPO',
      updated: 'Atualizado: 26 de outubro de 2026',
      blocks: [
        { t: 'p', html: 'TEMPO é um diário de jogos para o pai à beira do campo e um modo treinador separado. Sem anúncios nem analítica de terceiros. Parte dos dados fica no telemóvel; parte vai para a conta só se iniciares sessão.' },
        { t: 'h2', text: 'O que guardamos' },
        { t: 'ul', items: [
          'perfil do jogador: nome, equipa, posições, foto e fundo do cartão. Pode ser preenchido por um pai ou treinador, inclusive se o jogador for criança. A app é para pais e treinadores;',
          'email ou conta Google se iniciares sessão;',
          'jogos, avaliações, comentários, época e definições;',
          'para o treinador: academia, equipas, plantel, jogos de equipa, convites aos pais, chat e respostas, e se a criança irá ao treino ou ao jogo.'
        ]},
        { t: 'h2', text: 'Onde fica' },
        { t: 'ul', items: [
          '<strong>Época pessoal gratuita</strong> fica neste telemóvel. Iniciar sessão por si não a envia para a nuvem.',
          '<strong>Cópia «No telemóvel»</strong> — ficheiro da época em Transferências / TEMPO. O ficheiro inclui a foto se estiver no cartão.',
          '<strong>TEMPO Pro</strong>, com sessão, sincroniza a época pessoal entre telemóveis. Essa cópia na nuvem inclui a foto com os jogos.',
          '<strong>Treinador e pai convidado</strong>, com sessão, guardam equipa, convites, chat e calendário na nuvem da conta — à parte da época pessoal à beira do campo.',
          'O cartão de jogo guardado na galeria vai para Pictures/Tempo no telemóvel.'
        ]},
        { t: 'p', html: 'As fotos não são publicadas à parte nem vendidas. Viajam só dentro da tua cópia ou da nuvem da conta.' },
        { t: 'h2', text: 'O que nunca recebemos' },
        { t: 'p', html: 'As subscrições TEMPO Pro e TEMPO Coach são cobradas pela Google Play e App Store. Não recebemos o número do cartão — só se a subscrição está ativa. Cancela nas subscrições Google Play ou Apple.' },
        { t: 'h2', text: 'Terminar sessão e apagar' },
        { t: 'p', html: 'Em Definições → Terminar sessão, o email desliga-se neste telemóvel. A nuvem fica.' },
        { t: 'p', html: '«Limpar dados neste telemóvel» apaga a época só neste dispositivo e não toca na nuvem.' },
        { t: 'p', html: '«Eliminar conta» no fundo das Definições apaga a nuvem desse início de sessão: época Pro, equipas do treinador e convites aos pais. A época só no telemóvel fica. Se o botão falhar, escreve para <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20delete%20account">o suporte</a> a partir do endereço com que entraste.' },
        { t: 'h2', text: 'Permissões Android' },
        { t: 'ul', items: [
          '<strong>Notificações</strong> — uma mensagem nova do chat chega uma vez por push. O lembrete de treino ou jogo dispara à hora que ativaste.',
          '<strong>Câmara</strong> — foto do jogador ou fundo, só quando tu tocas.',
          '<strong>Galeria / fotos</strong> — escolher uma foto e guardar o cartão de jogo em Pictures/Tempo.',
          '<strong>Internet</strong> — sessão, treinador, chat e nuvem Pro. O diário de jogos no telemóvel funciona offline.'
        ]},
        { t: 'h2', text: 'Contacto' },
        { t: 'p', html: 'Suporte: <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">email</a> · <a href="https://github.com/IhorMich/ffk/issues">GitHub Issues</a>.' }
      ]
    }
  };

  const terms = {
    en: {
      title: 'TEMPO — Terms of use',
      h1: 'TEMPO Terms of use',
      updated: 'Updated: 26 October 2026',
      blocks: [
        { t: 'p', html: 'TEMPO is an app for recording and rating a player’s football matches, and for parent and coach workflows.' },
        { t: 'h2', text: 'Use' },
        { t: 'ul', items: [
          'You are responsible for the data you enter: names, photos, ratings, parent contacts.',
          'Do not use the app for illegal content or invite spam.',
          'A free personal season lives on the device. TEMPO Pro is the same personal mode with cloud sync between phones. TEMPO Coach is a separate team account.'
        ]},
        { t: 'h2', text: 'Subscriptions and purchases' },
        { t: 'p', html: 'TEMPO Pro and TEMPO Coach are subscriptions in Google Play and the App Store. The price is shown before you pay. The store takes payment. Cancel or change the card in Google Play or Apple subscriptions.' },
        { t: 'h2', text: 'Data' },
        { t: 'p', html: 'Storage details are in the <a data-legal="privacy">privacy policy</a>. You can save a season copy in Settings with “On this phone”. The cloud account is removed with “Delete account”. A season only on the phone stays.' },
        { t: 'h2', text: 'Limitation of liability' },
        { t: 'p', html: 'Ratings and analytics are a training diary tool, not an official federation rating. The app is provided “as is”.' },
        { t: 'h2', text: 'Contact' },
        { t: 'p', html: 'Questions: <a href="https://github.com/IhorMich/ffk/issues">github.com/IhorMich/ffk/issues</a> · <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">email</a>.' }
      ]
    },
    ru: {
      title: 'TEMPO — условия использования',
      h1: 'Условия использования TEMPO',
      updated: 'Обновлено: 26 октября 2026',
      blocks: [
        { t: 'p', html: 'TEMPO — приложение для записи и оценки футбольных матчей игрока, а также работы родителя и тренера.' },
        { t: 'h2', text: 'Использование' },
        { t: 'ul', items: [
          'Вы отвечаете за данные, которые вводите: имена, фото, оценки, контакты родителей.',
          'Не используйте приложение для незаконного контента или спама приглашений.',
          'Бесплатный личный сезон живёт на устройстве. TEMPO Pro — тот же личный режим с облаком между телефонами. TEMPO Coach — отдельный командный аккаунт.'
        ]},
        { t: 'h2', text: 'Подписки и покупки' },
        { t: 'p', html: 'TEMPO Pro и TEMPO Coach — подписки в Google Play и App Store. Цена показывается до оплаты. Оплату принимает магазин. Отменить или сменить карту можно в подписках Google Play или Apple.' },
        { t: 'h2', text: 'Данные' },
        { t: 'p', html: 'Подробности хранения — в <a data-legal="privacy">политике конфиденциальности</a>. Копию сезона можно сохранить в Настройках кнопкой «На телефон». Облачный аккаунт удаляется кнопкой «Удалить аккаунт». Сезон только на телефоне при этом остаётся.' },
        { t: 'h2', text: 'Ограничение ответственности' },
        { t: 'p', html: 'Оценки и аналитика — инструмент тренировочного дневника, не официальный рейтинг федерации. Приложение предоставляется «как есть».' },
        { t: 'h2', text: 'Контакты' },
        { t: 'p', html: 'Вопросы: <a href="https://github.com/IhorMich/ffk/issues">github.com/IhorMich/ffk/issues</a> · <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">написать на email</a>.' }
      ]
    },
    uk: {
      title: 'TEMPO — умови використання',
      h1: 'Умови використання TEMPO',
      updated: 'Оновлено: 26 жовтня 2026',
      blocks: [
        { t: 'p', html: 'TEMPO — застосунок для запису й оцінки футбольних матчів гравця, а також роботи батька й тренера.' },
        { t: 'h2', text: 'Використання' },
        { t: 'ul', items: [
          'Ви відповідаєте за дані, які вводите: імена, фото, оцінки, контакти батьків.',
          'Не використовуйте застосунок для незаконного контенту або спаму запрошень.',
          'Безкоштовний особистий сезон живе на пристрої. TEMPO Pro — той самий особистий режим із хмарою між телефонами. TEMPO Coach — окремий командний акаунт.'
        ]},
        { t: 'h2', text: 'Підписки та покупки' },
        { t: 'p', html: 'TEMPO Pro і TEMPO Coach — підписки в Google Play та App Store. Ціна показується до оплати. Оплату приймає магазин. Скасувати або змінити картку можна в підписках Google Play або Apple.' },
        { t: 'h2', text: 'Дані' },
        { t: 'p', html: 'Подробиці зберігання — у <a data-legal="privacy">політиці конфіденційності</a>. Копію сезону можна зберегти в Налаштуваннях кнопкою «На телефон». Хмарний акаунт видаляється кнопкою «Видалити акаунт». Сезон лише на телефоні при цьому лишається.' },
        { t: 'h2', text: 'Обмеження відповідальності' },
        { t: 'p', html: 'Оцінки й аналітика — інструмент тренувального щоденника, не офіційний рейтинг федерації. Застосунок надається «як є».' },
        { t: 'h2', text: 'Контакти' },
        { t: 'p', html: 'Питання: <a href="https://github.com/IhorMich/ffk/issues">github.com/IhorMich/ffk/issues</a> · <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">написати на email</a>.' }
      ]
    },
    pl: {
      title: 'TEMPO — warunki korzystania',
      h1: 'Warunki korzystania z TEMPO',
      updated: 'Zaktualizowano: 26 października 2026',
      blocks: [
        { t: 'p', html: 'TEMPO to aplikacja do zapisu i oceny meczów piłkarskich zawodnika oraz pracy rodzica i trenera.' },
        { t: 'h2', text: 'Korzystanie' },
        { t: 'ul', items: [
          'Odpowiadasz za dane, które wprowadzasz: imiona, zdjęcia, oceny, kontakty rodziców.',
          'Nie używaj aplikacji do nielegalnych treści ani spamu zaproszeń.',
          'Darmowy sezon osobisty żyje na urządzeniu. TEMPO Pro to ten sam tryb osobisty z chmurą między telefonami. TEMPO Coach to osobne konto drużynowe.'
        ]},
        { t: 'h2', text: 'Subskrypcje i zakupy' },
        { t: 'p', html: 'TEMPO Pro i TEMPO Coach to subskrypcje w Google Play i App Store. Cena jest widoczna przed płatnością. Płatność przyjmuje sklep. Anuluj lub zmień kartę w subskrypcjach Google Play lub Apple.' },
        { t: 'h2', text: 'Dane' },
        { t: 'p', html: 'Szczegóły przechowywania — w <a data-legal="privacy">polityce prywatności</a>. Kopię sezonu możesz zapisać w Ustawieniach przyciskiem „Na telefon”. Konto w chmurze usuwa się przyciskiem „Usuń konto”. Sezon tylko na telefonie zostaje.' },
        { t: 'h2', text: 'Ograniczenie odpowiedzialności' },
        { t: 'p', html: 'Oceny i analityka to narzędzie dziennika treningowego, nie oficjalny ranking federacji. Aplikacja jest dostarczana „tak jak jest”.' },
        { t: 'h2', text: 'Kontakt' },
        { t: 'p', html: 'Pytania: <a href="https://github.com/IhorMich/ffk/issues">github.com/IhorMich/ffk/issues</a> · <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">napisz e-mail</a>.' }
      ]
    },
    es: {
      title: 'TEMPO — términos de uso',
      h1: 'Términos de uso de TEMPO',
      updated: 'Actualizado: 26 de octubre de 2026',
      blocks: [
        { t: 'p', html: 'TEMPO es una app para registrar y valorar partidos de fútbol de un jugador, y para el trabajo de padres y entrenadores.' },
        { t: 'h2', text: 'Uso' },
        { t: 'ul', items: [
          'Eres responsable de los datos que introduces: nombres, fotos, valoraciones, contactos de padres.',
          'No uses la app para contenido ilegal ni spam de invitaciones.',
          'La temporada personal gratuita vive en el dispositivo. TEMPO Pro es el mismo modo personal con nube entre teléfonos. TEMPO Coach es una cuenta de equipo aparte.'
        ]},
        { t: 'h2', text: 'Suscripciones y compras' },
        { t: 'p', html: 'TEMPO Pro y TEMPO Coach son suscripciones en Google Play y App Store. El precio se muestra antes de pagar. Cobra la tienda. Cancela o cambia la tarjeta en las suscripciones de Google Play o Apple.' },
        { t: 'h2', text: 'Datos' },
        { t: 'p', html: 'Los detalles de almacenamiento están en la <a data-legal="privacy">política de privacidad</a>. Puedes guardar una copia de la temporada en Ajustes con «Al teléfono». La cuenta en la nube se elimina con «Eliminar cuenta». La temporada solo en el teléfono permanece.' },
        { t: 'h2', text: 'Limitación de responsabilidad' },
        { t: 'p', html: 'Las valoraciones y el análisis son una herramienta de diario de entrenamiento, no un ranking oficial de federación. La app se ofrece «tal cual».' },
        { t: 'h2', text: 'Contacto' },
        { t: 'p', html: 'Preguntas: <a href="https://github.com/IhorMich/ffk/issues">github.com/IhorMich/ffk/issues</a> · <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">escribir un email</a>.' }
      ]
    },
    de: {
      title: 'TEMPO — Nutzungsbedingungen',
      h1: 'TEMPO-Nutzungsbedingungen',
      updated: 'Aktualisiert: 26. Oktober 2026',
      blocks: [
        { t: 'p', html: 'TEMPO ist eine App zum Aufzeichnen und Bewerten von Fußballspielen eines Spielers sowie für Eltern- und Trainer-Abläufe.' },
        { t: 'h2', text: 'Nutzung' },
        { t: 'ul', items: [
          'Du bist für die eingegebenen Daten verantwortlich: Namen, Fotos, Bewertungen, Elternkontakte.',
          'Nutze die App nicht für illegale Inhalte oder Einladungs-Spam.',
          'Die kostenlose persönliche Saison lebt auf dem Gerät. TEMPO Pro ist derselbe persönliche Modus mit Cloud zwischen Telefonen. TEMPO Coach ist ein separates Team-Konto.'
        ]},
        { t: 'h2', text: 'Abos und Käufe' },
        { t: 'p', html: 'TEMPO Pro und TEMPO Coach sind Abos in Google Play und dem App Store. Der Preis wird vor dem Kauf gezeigt. Der Store nimmt die Zahlung an. Kündigen oder Karte ändern in den Abos von Google Play oder Apple.' },
        { t: 'h2', text: 'Daten' },
        { t: 'p', html: 'Speicherdetails stehen in der <a data-legal="privacy">Datenschutzerklärung</a>. Eine Saison-Kopie speicherst du in den Einstellungen mit „Aufs Telefon“. Das Cloud-Konto wird mit „Konto löschen“ entfernt. Die Saison nur auf dem Telefon bleibt.' },
        { t: 'h2', text: 'Haftungsbeschränkung' },
        { t: 'p', html: 'Bewertungen und Analyse sind ein Trainings-Tagebuch-Werkzeug, kein offizielles Verbandsranking. Die App wird „wie besehen“ bereitgestellt.' },
        { t: 'h2', text: 'Kontakt' },
        { t: 'p', html: 'Fragen: <a href="https://github.com/IhorMich/ffk/issues">github.com/IhorMich/ffk/issues</a> · <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">E-Mail schreiben</a>.' }
      ]
    },
    it: {
      title: 'TEMPO — termini di utilizzo',
      h1: 'Termini di utilizzo di TEMPO',
      updated: 'Aggiornato: 26 ottobre 2026',
      blocks: [
        { t: 'p', html: 'TEMPO è un’app per registrare e valutare le partite di calcio di un giocatore e per il lavoro di genitori e allenatori.' },
        { t: 'h2', text: 'Uso' },
        { t: 'ul', items: [
          'Sei responsabile dei dati che inserisci: nomi, foto, valutazioni, contatti dei genitori.',
          'Non usare l’app per contenuti illegali o spam di inviti.',
          'La stagione personale gratuita vive sul dispositivo. TEMPO Pro è la stessa modalità personale con cloud tra telefoni. TEMPO Coach è un account squadra separato.'
        ]},
        { t: 'h2', text: 'Abbonamenti e acquisti' },
        { t: 'p', html: 'TEMPO Pro e TEMPO Coach sono abbonamenti in Google Play e App Store. Il prezzo è mostrato prima del pagamento. Paga lo store. Annulla o cambia carta nelle sottoscrizioni Google Play o Apple.' },
        { t: 'h2', text: 'Dati' },
        { t: 'p', html: 'I dettagli di archiviazione sono nella <a data-legal="privacy">informativa sulla privacy</a>. Puoi salvare una copia della stagione in Impostazioni con «Sul telefono». L’account cloud si elimina con «Elimina account». La stagione solo sul telefono resta.' },
        { t: 'h2', text: 'Limitazione di responsabilità' },
        { t: 'p', html: 'Valutazioni e analisi sono uno strumento di diario di allenamento, non un ranking ufficiale di federazione. L’app è fornita «così com’è».' },
        { t: 'h2', text: 'Contatti' },
        { t: 'p', html: 'Domande: <a href="https://github.com/IhorMich/ffk/issues">github.com/IhorMich/ffk/issues</a> · <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">scrivi un’email</a>.' }
      ]
    },
    fr: {
      title: 'TEMPO — conditions d’utilisation',
      h1: 'Conditions d’utilisation TEMPO',
      updated: 'Mis à jour : 26 octobre 2026',
      blocks: [
        { t: 'p', html: 'TEMPO est une application pour enregistrer et noter les matchs de football d’un joueur, ainsi que le travail des parents et des coachs.' },
        { t: 'h2', text: 'Utilisation' },
        { t: 'ul', items: [
          'Vous êtes responsable des données que vous saisissez : noms, photos, notes, contacts des parents.',
          'N’utilisez pas l’app pour du contenu illégal ou du spam d’invitations.',
          'La saison perso gratuite vit sur l’appareil. TEMPO Pro est le même mode perso avec cloud entre téléphones. TEMPO Coach est un compte équipe séparé.'
        ]},
        { t: 'h2', text: 'Abonnements et achats' },
        { t: 'p', html: 'TEMPO Pro et TEMPO Coach sont des abonnements dans Google Play et l’App Store. Le prix s’affiche avant le paiement. Le magasin encaisse. Résiliez ou changez de carte dans les abonnements Google Play ou Apple.' },
        { t: 'h2', text: 'Données' },
        { t: 'p', html: 'Les détails de stockage sont dans la <a data-legal="privacy">politique de confidentialité</a>. Vous pouvez enregistrer une copie de saison dans Réglages avec « Sur le téléphone ». Le compte cloud se supprime avec « Supprimer le compte ». La saison uniquement sur le téléphone reste.' },
        { t: 'h2', text: 'Limitation de responsabilité' },
        { t: 'p', html: 'Notes et analyse sont un outil de carnet d’entraînement, pas un classement officiel de fédération. L’app est fournie « en l’état ».' },
        { t: 'h2', text: 'Contact' },
        { t: 'p', html: 'Questions : <a href="https://github.com/IhorMich/ffk/issues">github.com/IhorMich/ffk/issues</a> · <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">écrire un e-mail</a>.' }
      ]
    },
    pt: {
      title: 'TEMPO — termos de utilização',
      h1: 'Termos de utilização TEMPO',
      updated: 'Atualizado: 26 de outubro de 2026',
      blocks: [
        { t: 'p', html: 'TEMPO é uma app para registar e avaliar jogos de futebol de um jogador, e para o trabalho de pais e treinadores.' },
        { t: 'h2', text: 'Utilização' },
        { t: 'ul', items: [
          'És responsável pelos dados que introduzes: nomes, fotos, avaliações, contactos dos pais.',
          'Não uses a app para conteúdo ilegal ou spam de convites.',
          'A época pessoal gratuita vive no dispositivo. TEMPO Pro é o mesmo modo pessoal com nuvem entre telemóveis. TEMPO Coach é uma conta de equipa à parte.'
        ]},
        { t: 'h2', text: 'Subscrições e compras' },
        { t: 'p', html: 'TEMPO Pro e TEMPO Coach são subscrições na Google Play e App Store. O preço aparece antes do pagamento. A loja cobra. Cancela ou muda o cartão nas subscrições Google Play ou Apple.' },
        { t: 'h2', text: 'Dados' },
        { t: 'p', html: 'Os detalhes de armazenamento estão na <a data-legal="privacy">política de privacidade</a>. Podes guardar uma cópia da época nas Definições com «No telemóvel». A conta na nuvem remove-se com «Eliminar conta». A época só no telemóvel fica.' },
        { t: 'h2', text: 'Limitação de responsabilidade' },
        { t: 'p', html: 'Avaliações e análise são uma ferramenta de diário de treino, não um ranking oficial de federação. A app é fornecida «tal como está».' },
        { t: 'h2', text: 'Contacto' },
        { t: 'p', html: 'Perguntas: <a href="https://github.com/IhorMich/ffk/issues">github.com/IhorMich/ffk/issues</a> · <a href="mailto:ihormykhailiuk@gmail.com?subject=TEMPO%20support">escrever um email</a>.' }
      ]
    }
  };

  function pick(map, lang) {
    if (map[lang]) return map[lang];
    return map.en;
  }

  function renderBlocks(root, blocks, theme, lang) {
    root.innerHTML = '';
    (blocks || []).forEach(function (b) {
      if (b.t === 'h2') {
        const h = document.createElement('h2');
        h.textContent = b.text || '';
        root.appendChild(h);
        return;
      }
      if (b.t === 'ul') {
        const ul = document.createElement('ul');
        (b.items || []).forEach(function (item) {
          const li = document.createElement('li');
          li.innerHTML = item;
          ul.appendChild(li);
        });
        root.appendChild(ul);
        return;
      }
      const p = document.createElement('p');
      p.innerHTML = b.html || '';
      root.appendChild(p);
    });
    root.querySelectorAll('a[data-legal]').forEach(function (a) {
      const kind = a.getAttribute('data-legal');
      a.setAttribute('href', kind + '.html' + q(theme, lang));
    });
  }

  function mount(kind) {
    let theme = 'dark';
    let lang = 'en';
    try {
      const sp = new URLSearchParams(location.search);
      if (sp.get('theme') === 'day') theme = 'day';
      const raw = String(sp.get('lang') || '').toLowerCase();
      if (LANGS.indexOf(raw) >= 0) lang = raw;
    } catch (e) {}
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    const pack = kind === 'terms' ? terms : privacy;
    const copy = pick(pack, lang);
    document.title = copy.title;
    const main = document.getElementById('legalMain');
    if (!main) return;
    const h1 = document.createElement('h1');
    h1.textContent = copy.h1;
    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = copy.updated;
    main.appendChild(h1);
    main.appendChild(meta);
    renderBlocks(main, copy.blocks, theme, lang);

    if (window.parent !== window) return;
    const back = document.createElement('p');
    back.className = 'back';
    back.innerHTML = '<a href="./">← TEMPO</a>';
    main.insertBefore(back, main.firstChild);
    window.ffkBack = function () {
      try { location.href = './'; } catch (e) {}
      return true;
    };
  }

  global.FFK_LEGAL = { privacy: privacy, terms: terms, langs: LANGS, mount: mount, query: q };
})(typeof window !== 'undefined' ? window : this);
