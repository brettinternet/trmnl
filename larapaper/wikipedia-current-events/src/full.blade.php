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
    $hasData = $wikitext !== '' && $events !== [];
@endphp

<style>
    .wikipedia-current-events {
        background: #ffffff;
        box-sizing: border-box;
        color: #000000;
        height: 100%;
        padding: 18px 22px 42px;
        width: 100%;
    }

    .wikipedia-current-events__list {
        align-content: start;
        display: grid;
        gap: 9px 18px;
        grid-template-columns: repeat({{ $eventColumns }}, minmax(0, 1fr));
    }

    .wikipedia-current-events__item {
        break-inside: avoid;
        display: grid;
        gap: 7px;
        grid-template-columns: auto minmax(0, 1fr);
        min-width: 0;
        margin: 0;
        padding-bottom: 7px;
    }

    .wikipedia-current-events__item::before {
        content: "•";
        font-size: {{ $eventFontSize }}px;
        line-height: 1.15;
    }

    .wikipedia-current-events__item-text {
        font-size: {{ $eventFontSize }}px;
        line-height: 1.15;
        margin: 0;
    }

    .wikipedia-current-events__empty {
        align-items: center;
        display: flex;
        height: 100%;
        justify-content: center;
        text-align: center;
    }

    @media (max-width: 520px) {
        .wikipedia-current-events {
            padding: 14px 16px 36px;
        }

        .wikipedia-current-events__list {
            gap: 7px 12px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .wikipedia-current-events__item {
            gap: 5px;
            padding-bottom: 5px;
        }

        .wikipedia-current-events__item-text,
        .wikipedia-current-events__item::before {
            font-size: 8px;
        }
    }
</style>

<div class="view view--full wikipedia-current-events">
    @if ($hasData)
        <section class="wikipedia-current-events__list" aria-label="Current event descriptions">
            @foreach ($events as $event)
                <p class="wikipedia-current-events__item">
                    <span class="wikipedia-current-events__item-text">{{ $event }}</span>
                </p>
            @endforeach
        </section>
    @else
        <div class="wikipedia-current-events__empty">
            <span class="value value--large">No current events available</span>
        </div>
    @endif
</div>
