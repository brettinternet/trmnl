<?php
    $value_text = static function ($value): string {
        if ($value instanceof \Illuminate\Support\Collection) {
            $value = $value->all();
        }

        if (is_object($value)) {
            $value = (array) $value;
        }

        if (is_array($value)) {
            $text = data_get($value, '_text');

            if ($text !== null) {
                return (string) $text;
            }

            return '';
        }

        return (string) ($value ?? '');
    };

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

    $description = $value_text(data_get($selected_item, 'description'));
    $description_html = html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    $image_url = '';
    if (preg_match('/<img\b[^>]*\bsrc=("|\')(.*?)\1/i', $description_html, $image_match)) {
        $image_url = html_entity_decode($image_match[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    $has_image = $selected_item !== [] && $image_url !== '';
?>

<style>
    .calvin-hobbes-screen {
        background: #ffffff;
        box-sizing: border-box;
        color: #000000;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        padding: 12px 16px 8px;
        width: 100%;
    }

    .calvin-hobbes-screen__image-wrap {
        align-items: center;
        display: flex;
        flex: 1 1 auto;
        justify-content: center;
        min-height: 0;
        width: 100%;
    }

    .calvin-hobbes-screen__image {
        display: block;
        filter: grayscale(1) contrast(1.08);
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
    }

    .calvin-hobbes-screen__error {
        align-items: center;
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        justify-content: center;
        text-align: center;
    }
</style>

<div class="calvin-hobbes-screen">
    <?php if ($has_image): ?>
        <div class="calvin-hobbes-screen__image-wrap">
            <img class="calvin-hobbes-screen__image" src="<?= e($image_url) ?>" alt="">
        </div>
    <?php else: ?>
        <div class="calvin-hobbes-screen__error">
            <span class="value value--large">Calvin and Hobbes unavailable</span>
            <span class="label">Check the ComicCaster RSS feed</span>
        </div>
    <?php endif; ?>
</div>
