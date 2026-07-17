@php
    $wikitextCandidates = [
        data_get($data ?? null, 'parse.wikitext'),
        data_get($data ?? null, 'data.parse.wikitext'),
        data_get($data ?? null, 'wikitext'),
        data_get($data ?? null, 'data.wikitext'),
    ];

    $wikitext = '';
    foreach ($wikitextCandidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            $wikitext = $candidate;
            break;
        }
    }
    $wikitext = preg_replace(
        '/^\s*\{\{Current events\|[^{}]*\|content=\s*/su',
        '',
        $wikitext,
    ) ?? $wikitext;
    $wikitext = preg_replace('/\}\}\s*$/su', '', $wikitext) ?? $wikitext;

    $cleanWikitext = static function ($value): string {
        $value = (string) $value;
        $value = preg_replace('/<!--.*?-->/s', ' ', $value) ?? $value;

        for ($i = 0; $i < 4; $i++) {
            $next = preg_replace('/\{\{[^{}]*\}\}/u', ' ', $value);
            if ($next === null || $next === $value) {
                break;
            }
            $value = $next;
        }

        $value = preg_replace('/\[\[([^|\]]+)\|([^\]]+)\]\]/u', '$2', $value) ?? $value;
        $value = preg_replace('/\[\[([^\]]+)\]\]/u', '$1', $value) ?? $value;
        $value = preg_replace('/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]+)\]/u', '$1', $value) ?? $value;
        $value = preg_replace('/\[(?:https?:)?\/\/[^\]]+\]/u', ' ', $value) ?? $value;
        $value = preg_replace("/'{2,5}/", '', $value) ?? $value;
        $value = strip_tags($value);
        $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;

        return trim($value);
    };

    $events = [];
    $lines = preg_split('/\R/u', $wikitext) ?: [];
    $lineCount = count($lines);

    foreach ($lines as $index => $line) {
        if (! preg_match('/^\s*(\*+)\s*(.+)$/u', $line, $match)) {
            continue;
        }

        $depth = strlen($match[1]);
        $hasChild = false;
        for ($nextIndex = $index + 1; $nextIndex < $lineCount; $nextIndex++) {
            $nextLine = $lines[$nextIndex];
            if (trim($nextLine) === '') {
                continue;
            }
            if (preg_match('/^\s*(\*+)\s*(.+)$/u', $nextLine, $nextMatch)) {
                $hasChild = strlen($nextMatch[1]) > $depth;
            }
            break;
        }

        // Leaf bullets are the complete event descriptions; parent bullets are topic labels.
        if ($hasChild) {
            continue;
        }

        $description = $cleanWikitext($match[2]);
        if ($description === '') {
            continue;
        }


        if (! in_array($description, $events, true)) {
            $events[] = $description;
        }
    }

    $totalCharacters = 0;
    foreach ($events as $event) {
        $totalCharacters += mb_strlen($event);
    }
    $eventColumns = count($events) > 6 ? 3 : (count($events) > 3 ? 2 : 1);
    $eventFontSize = 15;
    if ($totalCharacters > 1200) {
        $eventFontSize = 10;
    }
    if ($totalCharacters > 2000) {
        $eventFontSize = 9;
    }
    if ($totalCharacters > 3200) {
        $eventFontSize = 8;
    }
    $selectedEvents = $events;
    $dateLabel = gmdate('l, F j, Y');
    $hasData = $wikitext !== '' && $events !== [];
@endphp

<style>
    .wikipedia-current-events {
        background: #ffffff;
        box-sizing: border-box;
        color: #000000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        height: 100%;
        padding: 16px 20px 44px;
        width: 100%;
    }

    .wikipedia-current-events__header {
        align-items: baseline;
        border-bottom: 2px solid #000000;
        display: flex;
        flex: 0 0 auto;
        gap: 12px;
        justify-content: space-between;
        padding-bottom: 6px;
    }

    .wikipedia-current-events__title {
        font-size: 26px;
        font-weight: 700;
        line-height: 1.05;
    }

    .wikipedia-current-events__date {
        font-size: 16px;
        line-height: 1.1;
        white-space: nowrap;
    }

    .wikipedia-current-events__list {
        display: grid;
        flex: 1 1 auto;
        gap: 6px;
        grid-template-columns: repeat({{ $eventColumns }}, minmax(0, 1fr));
        min-height: 0;
    }

    .wikipedia-current-events__item {
        border: 1px solid #000000;
        break-inside: avoid;
        min-width: 0;
        padding: 5px 7px;
    }

    .wikipedia-current-events__item-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        line-height: 1.1;
        margin-bottom: 3px;
        text-transform: uppercase;
    }

    .wikipedia-current-events__item-text {
        font-size: {{ $eventFontSize }}px;
        line-height: 1.15;
        margin: 0;
    }


    .wikipedia-current-events__empty {
        align-items: center;
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        justify-content: center;
        text-align: center;
    }

    @media (max-width: 520px) {
        .wikipedia-current-events__list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .wikipedia-current-events__item {
            padding: 4px 5px;
        }

        .wikipedia-current-events__item-text {
            font-size: 8px;
        }

        .wikipedia-current-events__title {
            font-size: 22px;
        }

        .wikipedia-current-events__date {
            font-size: 12px;
        }
    }
</style>

<div class="view view--full wikipedia-current-events">
    <div class="wikipedia-current-events__header">
        <div class="wikipedia-current-events__title">Wikipedia Current Events</div>
        <div class="wikipedia-current-events__date">{{ $dateLabel }}</div>
    </div>

    @if ($hasData)
        <section class="wikipedia-current-events__list" aria-label="Current event descriptions">
            @foreach ($selectedEvents as $event)
                <article class="wikipedia-current-events__item">
                    <div class="wikipedia-current-events__item-label">Event {{ $loop->iteration }}</div>
                    <p class="wikipedia-current-events__item-text">{{ $event }}</p>
                </article>
            @endforeach
        </section>
    @else
        <div class="wikipedia-current-events__empty">
            <span class="value value--large">Current events unavailable</span>
            <span class="label">Wikipedia returned no event descriptions for today.</span>
        </div>
    @endif

    <div class="title_bar">
        <span class="title">Wikipedia</span>
        <span class="instance">Current events</span>
    </div>
</div>
