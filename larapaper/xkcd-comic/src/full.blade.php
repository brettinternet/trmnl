@php
    $payload = data_get($data, 'data', $data);

    if (! data_get($payload, 'img') && is_array($payload)) {
        foreach ($payload as $item) {
            if (is_array($item) && data_get($item, 'img')) {
                $payload = $item;
                break;
            }
        }
    }

    $title = (string) data_get($payload, 'safe_title', data_get($payload, 'title', 'XKCD'));
    $comicNumber = data_get($payload, 'num');
    $imageUrl = (string) data_get($payload, 'img', '');
    $altText = (string) data_get($payload, 'alt', '');
    $month = data_get($payload, 'month');
    $day = data_get($payload, 'day');
    $year = data_get($payload, 'year');
    $date = $year && $month && $day ? sprintf('%04d-%02d-%02d', (int) $year, (int) $month, (int) $day) : '';
@endphp

<style>
    .xkcd-comic {
        height: 100%;
        width: 100%;
        background: #ffffff;
        color: #000000;
    }

    .xkcd-comic__content {
        height: 100%;
        padding: 18px 22px 44px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .xkcd-comic__header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 2px solid #000000;
        padding-bottom: 6px;
    }

    .xkcd-comic__title {
        font-size: 26px;
        font-weight: 700;
        line-height: 1.05;
    }

    .xkcd-comic__number {
        font-size: 16px;
        white-space: nowrap;
    }

    .xkcd-comic__frame {
        min-height: 0;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .xkcd-comic__frame img {
        display: block;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        filter: grayscale(1) contrast(1.08);
    }

    .xkcd-comic__alt {
        font-size: 14px;
        line-height: 1.25;
        max-height: 52px;
        overflow: hidden;
        text-align: center;
    }
</style>

@if (! $imageUrl)
    <div class="view view--full">
        <div class="layout layout--col gap--space-between">
            <div class="item">
                <div class="meta"></div>
                <div class="content">
                    <span class="value value--large">XKCD unavailable</span>
                    <span class="label">No comic image returned by the XKCD JSON API</span>
                </div>
            </div>
        </div>

        <div class="title_bar">
            <span class="title">XKCD</span>
            <span class="instance">API error</span>
        </div>
    </div>
@else
    <div class="view view--full xkcd-comic">
        <div class="xkcd-comic__content">
            <div class="xkcd-comic__header">
                <div class="xkcd-comic__title">{{ $title }}</div>
                <div class="xkcd-comic__number">#{{ $comicNumber }}</div>
            </div>

            <div class="xkcd-comic__frame">
                <img src="{{ $imageUrl }}" alt="">
            </div>

            @if ($altText)
                <div class="xkcd-comic__alt">{{ $altText }}</div>
            @endif
        </div>

        <div class="title_bar">
            <span class="title">XKCD</span>
            <span class="instance">{{ $date ?: 'Comic' }}</span>
        </div>
    </div>
@endif
