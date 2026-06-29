<?php
    $customFields = data_get($trmnl, 'plugin_settings.custom_fields_values', []);
    $configuredPosition = data_get($config, 'comic_position', data_get($customFields, 'comic_position', '1'));
    $comicPosition = max(1, (int) $configuredPosition);
    $showCaptionRaw = data_get($config, 'show_caption', data_get($customFields, 'show_caption', 'yes'));
    $showCaption = filter_var($showCaptionRaw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    $showCaption = $showCaption ?? true;

    $channel = data_get($data, 'rss.channel', []);
    $items = data_get($channel, 'item', []);

    if (is_array($items) && $items !== [] && array_keys($items) !== range(0, count($items) - 1)) {
        $items = [$items];
    }

    $items = is_array($items) ? array_values($items) : [];
    $selectedIndex = min($comicPosition - 1, max(count($items) - 1, 0));
    $comic = $items[$selectedIndex] ?? null;

    $description = (string) data_get($comic, 'description', '');
    $descriptionHtml = html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $imageUrl = null;
    $caption = null;

    if (preg_match('/<img\b[^>]*\bsrc=("|\')([^"\']+)\1/i', $descriptionHtml, $imageMatch)) {
        $imageUrl = html_entity_decode($imageMatch[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    if (preg_match_all('/<p\b[^>]*>(.*?)<\/p>/is', $descriptionHtml, $paragraphMatches)) {
        foreach ($paragraphMatches[1] as $paragraphHtml) {
            $paragraphText = html_entity_decode(strip_tags($paragraphHtml), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $paragraphText = trim(preg_replace('/\s+/', ' ', $paragraphText));

            if ($paragraphText === '' || str_contains($paragraphText, 'Visit The Far Side') || str_contains($paragraphText, 'Gary Larson')) {
                continue;
            }

            $caption = $paragraphText;
            break;
        }
    }

    $title = (string) data_get($comic, 'title', 'The Far Side');
    $link = (string) data_get($comic, 'link', 'https://www.thefarside.com/');
    $published = (string) data_get($comic, 'pubDate', '');

    try {
        $publishedLabel = $published !== '' ? \Carbon\Carbon::parse($published)->format('M j, Y') : '';
    } catch (\Throwable $e) {
        $publishedLabel = '';
    }

    $hasComic = $comic && $imageUrl;
    $altText = $caption ?: $title;
    $instanceText = $publishedLabel ?: $link;
?>

<style>
    .farside-frame {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: 10px;
        height: 100%;
        justify-content: center;
        overflow: hidden;
        width: 100%;
    }

    .farside-frame__image-wrap {
        align-items: center;
        display: flex;
        flex: 1 1 auto;
        justify-content: center;
        min-height: 0;
        width: 100%;
    }

    .farside-frame__image {
        filter: grayscale(1) contrast(1.08);
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
    }

    .farside-frame__caption {
        font-size: 18px;
        font-style: italic;
        line-height: 1.2;
        max-height: 46px;
        overflow: hidden;
        text-align: center;
    }
</style>

<?php if (! $hasComic): ?>
    <div class="view view--full">
        <div class="layout layout--col gap--space-between">
            <div class="item">
                <div class="meta"></div>
                <div class="content">
                    <span class="value value--large">Far Side unavailable</span>
                    <span class="label">Check the ComicCaster RSS feed</span>
                </div>
            </div>
        </div>

        <div class="title_bar">
            <span class="title">The Far Side</span>
            <span class="instance">No comic image found</span>
        </div>
    </div>
<?php else: ?>
    <div class="view view--full">
        <div class="layout layout--col gap--space-between">
            <div class="farside-frame">
                <div class="farside-frame__image-wrap">
                    <img class="farside-frame__image" src="<?= e($imageUrl) ?>" alt="<?= e($altText) ?>">
                </div>

                <?php if ($showCaption && $caption): ?>
                    <div class="farside-frame__caption"><?= e($caption) ?></div>
                <?php endif; ?>
            </div>
        </div>

        <div class="title_bar">
            <span class="title">The Far Side</span>
            <span class="instance"><?= e($instanceText) ?></span>
        </div>
    </div>
<?php endif; ?>
