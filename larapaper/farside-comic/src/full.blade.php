<?php
    $custom_fields = data_get($trmnl ?? null, 'plugin_settings.custom_fields_values', []);
    $show_caption_value = strtolower((string) (data_get($custom_fields, 'show_caption') ?? data_get($config ?? [], 'show_caption') ?? 'yes'));
    $show_caption = ! in_array($show_caption_value, ['no', 'false', '0'], true);
    $image_color_mode_value = strtolower((string) (data_get($custom_fields, 'image_color_mode') ?? data_get($config ?? [], 'image_color_mode') ?? 'grayscale'));
    $image_filter = in_array($image_color_mode_value, ['original', 'color'], true) ? 'none' : 'grayscale(1) contrast(1.08)';

    $items = data_get($rss ?? null, 'channel.item')
        ?? data_get($data ?? [], 'rss.channel.item')
        ?? data_get($data ?? [], 'data.rss.channel.item')
        ?? data_get($data ?? [], 'channel.item')
        ?? [];

    if ($items instanceof \Illuminate\Support\Collection) {
        $items = $items->all();
    }

    if (is_object($items)) {
        $items = (array) $items;
    }

    if (is_array($items) && $items !== [] && array_keys($items) !== range(0, count($items) - 1)) {
        $items = [$items];
    }

    $items = is_array($items) ? array_values($items) : [];
    $selected_item = $items !== [] ? $items[array_rand($items)] : [];

    $link = (string) (data_get($selected_item, 'link') ?: 'https://www.thefarside.com/');
    $published_raw = (string) (data_get($selected_item, 'pubDate') ?: '');
    $published_time = $published_raw !== '' ? strtotime($published_raw) : false;
    $published_label = $published_time ? date('M j, Y', $published_time) : '';
    $description = (string) (data_get($selected_item, 'description') ?: '');
    $description_html = html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    $image_url = '';
    if (preg_match('/<img\b[^>]*\bsrc=("|\')(.*?)\1/i', $description_html, $image_match)) {
        $image_url = html_entity_decode($image_match[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    $caption = '';
    if (preg_match_all('/<p\b[^>]*>(.*?)<\/p>/is', $description_html, $paragraph_matches)) {
        foreach ($paragraph_matches[1] as $paragraph_html) {
            $candidate = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($paragraph_html), ENT_QUOTES | ENT_HTML5, 'UTF-8')));

            if ($candidate === '' || str_contains($candidate, 'Visit The Far Side') || str_contains($candidate, 'Gary Larson')) {
                continue;
            }

            $caption = $candidate;
            break;
        }
    }

    $has_image = $selected_item !== [] && $image_url !== '';
    $has_caption = $has_image && $show_caption && $caption !== '';
    $instance_text = $published_label ?: $link;
?>

<style>
    .farside-screen {
        background: #ffffff;
        box-sizing: border-box;
        color: #000000;
        display: flex;
        flex-direction: column;
        gap: 14px;
        height: 100%;
        overflow: hidden;
        padding: 12px 16px;
        width: 100%;
    }

    .farside-screen--with-caption {
        align-items: stretch;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .farside-screen__image-wrap {
        align-items: center;
        display: flex;
        flex: 1 1 auto;
        justify-content: center;
        min-height: 0;
        min-width: 0;
    }

    .farside-screen--with-caption .farside-screen__image-wrap {
        height: 100%;
    }

    .farside-screen__image {
        display: block;
        filter: <?= e($image_filter) ?>;
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
    }

    .farside-screen__caption {
        align-items: center;
        display: flex;
        font-size: 20px;
        font-style: italic;
        justify-content: flex-start;
        line-height: 1.2;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
        text-align: left;
    }

    .farside-screen__caption-text {
        display: -webkit-box;
        max-height: 100%;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 16;
    }

    @media (max-width: 520px) {
        .farside-screen--with-caption {
            display: flex;
            flex-direction: column;
        }

        .farside-screen--with-caption .farside-screen__image-wrap {
            height: auto;
        }

        .farside-screen__caption {
            font-size: 16px;
            max-height: 72px;
            text-align: center;
        }

        .farside-screen__caption-text {
            -webkit-line-clamp: 3;
        }
    }

    .farside-screen__error {
        align-items: center;
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        justify-content: center;
        text-align: center;
    }
</style>

<div class="farside-screen<?= $has_caption ? ' farside-screen--with-caption' : '' ?>">
    <?php if ($has_image): ?>
        <div class="farside-screen__image-wrap">
            <img class="farside-screen__image" src="<?= e($image_url) ?>" alt="">
        </div>

        <?php if ($has_caption): ?>
            <div class="farside-screen__caption"><span class="farside-screen__caption-text"><?= e($caption) ?></span></div>
        <?php endif; ?>
    <?php else: ?>
        <div class="farside-screen__error">
            <span class="value value--large">Far Side unavailable</span>
            <span class="label">Check the ComicCaster RSS feed</span>
        </div>
    <?php endif; ?>
</div>
