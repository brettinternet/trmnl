<?php
    $payload = $data ?? [];
    $article = data_get($payload, 'tfa')
        ?? data_get($payload, 'data.tfa')
        ?? data_get($payload, 'featured.tfa')
        ?? data_get($payload, 'data.featured.tfa')
        ?? [];

    if ($article instanceof \Illuminate\Support\Collection) {
        $article = $article->all();
    }

    if (is_object($article)) {
        $article = (array) $article;
    }

    $article = is_array($article) ? $article : [];
    $feed_error = data_get($payload, 'errors')
        ?? data_get($payload, 'error')
        ?? data_get($payload, 'status.error');
    $has_article = $article !== [] && ! $feed_error;

    $text_value = static function ($value): string {
        return is_scalar($value) ? trim((string) $value) : '';
    };

    $is_http_url = static function (string $url): bool {
        return (bool) preg_match('/^https?:\/\/[^\s]+$/i', $url);
    };

    $display_title = $text_value(data_get($article, 'titles.display'))
        ?: $text_value(data_get($article, 'displaytitle'));
    $title = $text_value(data_get($article, 'titles.normalized'))
        ?: $text_value(data_get($article, 'title'))
        ?: $text_value(data_get($article, 'normalizedtitle'));
    $title = str_replace('_', ' ', $title);
    if ($title === '') {
        $title = trim(html_entity_decode(strip_tags($display_title), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
    $title = $title ?: "Today's Featured Article";
    $description = $text_value(data_get($article, 'description'));
    $extract = $text_value(data_get($article, 'extract'));
    $article_date = $text_value(data_get($article, 'date'));

    $image_url = $text_value(data_get($article, 'thumbnail.source'));
    if (! $is_http_url($image_url)) {
        $image_url = $text_value(data_get($article, 'originalimage.source'));
    }
    if (! $is_http_url($image_url)) {
        $image_url = '';
    }

    $article_url = $text_value(data_get($article, 'content_urls.desktop.page'));
    if (! $is_http_url($article_url)) {
        $article_url = $text_value(data_get($article, 'content_urls.mobile.page'));
    }
    if (! $is_http_url($article_url)) {
        $article_url = '';
    }

    $qr_url = $article_url !== ''
        ? 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' . rawurlencode($article_url)
        : '';
?>

<style>
    .wfa-screen {
        box-sizing: border-box;
        color: #000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        min-height: 0;
        padding: 14px 18px;
        width: 100%;
    }

    .wfa-header {
        align-items: flex-start;
        display: flex;
        flex: 0 1 auto;
        gap: 16px;
        justify-content: space-between;
        min-height: 0;
    }

    .wfa-header__copy {
        min-width: 0;
    }

    .wfa-kicker {
        font-size: 14px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
    }

    .wfa-title {
        font-size: clamp(26px, 4vw, 42px);
        line-height: 1.05;
        margin: 4px 0 0;
        max-height: 3.2em;
        overflow: auto;
        overflow-wrap: anywhere;
    }

    .wfa-date {
        flex: 0 0 auto;
        font-size: 15px;
        font-weight: 700;
        padding-top: 2px;
        text-align: right;
        white-space: nowrap;
    }

    .wfa-main {
        align-items: stretch;
        display: grid;
        flex: 1 1 auto;
        gap: 18px;
        grid-template-columns: minmax(0, 1fr) minmax(150px, 27%);
        min-height: 0;
    }

    .wfa-copy {
        display: flex;
        flex-direction: column;
        min-height: 0;
        min-width: 0;
    }

    .wfa-description {
        font-size: 18px;
        font-weight: 700;
        line-height: 1.15;
        margin: 0 0 9px;
    }

    .wfa-extract {
        flex: 1 1 auto;
        font-size: 15px;
        line-height: 1.2;
        min-height: 0;
        overflow: visible;
        padding-right: 5px;
        white-space: pre-line;
    }

    .wfa-media {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: 10px;
        justify-content: center;
        min-height: 0;
        min-width: 0;
    }

    .wfa-image-wrap {
        align-items: center;
        border: 1px solid #777;
        box-sizing: border-box;
        display: flex;
        flex: 1 1 auto;
        justify-content: center;
        min-height: 0;
        min-width: 0;
        padding: 5px;
        width: 100%;
    }

    .wfa-image {
        display: block;
        height: auto;
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
        width: auto;
    }

    .wfa-no-image {
        font-size: 15px;
        font-weight: 700;
        padding: 20px 8px;
        text-align: center;
    }

    .wfa-qr {
        align-items: center;
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        font-size: 12px;
        gap: 3px;
        text-align: center;
    }

    .wfa-qr img {
        display: block;
        height: 86px;
        image-rendering: pixelated;
        width: 86px;
    }

    .wfa-link {
        border-top: 1px solid #777;
        flex: 0 0 auto;
        font-size: 13px;
        line-height: 1.2;
        overflow-wrap: anywhere;
        padding-top: 7px;
    }

    .wfa-footer {
        border-top: 1px solid #777;
        display: flex;
        flex: 0 0 auto;
        font-size: 13px;
        font-weight: 700;
        justify-content: space-between;
        padding-top: 7px;
    }

    .wfa-footer__source {
        font-weight: 400;
    }

    .wfa-error {
        align-items: center;
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        justify-content: center;
        min-height: 0;
        text-align: center;
    }

    .wfa-error__title {
        font-size: 28px;
        font-weight: 800;
    }

    .wfa-error__detail {
        font-size: 16px;
        margin-top: 7px;
    }

    @media (max-width: 560px) {
        .wfa-screen { padding: 10px 12px; }
        .wfa-main { gap: 10px; grid-template-columns: minmax(0, 1fr) minmax(112px, 35%); }
        .wfa-description { font-size: 17px; }
        .wfa-extract { font-size: 15px; }
        .wfa-date { font-size: 12px; }
        .wfa-qr img { height: 70px; width: 70px; }
    }
</style>

<?php if (! $has_article): ?>
    <div class="wfa-screen">
        <div class="wfa-error">
            <div class="wfa-error__title">Wikipedia unavailable</div>
            <div class="wfa-error__detail">Today's featured article could not be loaded.</div>
        </div>
        <div class="wfa-footer">
            <span>Wikipedia</span>
            <span class="wfa-footer__source">Wikimedia featured feed</span>
        </div>
    </div>
<?php else: ?>
    <div class="wfa-screen">
        <header class="wfa-header">
            <div class="wfa-header__copy">
                <div class="wfa-kicker">Today's featured article</div>
                <h1 class="wfa-title"><?= e($title) ?></h1>
            </div>
            <?php if ($article_date !== ''): ?>
                <div class="wfa-date"><?= e($article_date) ?></div>
            <?php endif; ?>
        </header>

        <main class="wfa-main">
            <section class="wfa-copy">
                <?php if ($description !== ''): ?>
                    <p class="wfa-description"><?= e($description) ?></p>
                <?php endif; ?>
                <?php if ($extract !== ''): ?>
                    <div class="wfa-extract"><?= e($extract) ?></div>
                <?php elseif ($description === ''): ?>
                    <div class="wfa-extract">No article description is available.</div>
                <?php endif; ?>
            </section>

            <aside class="wfa-media">
                <div class="wfa-image-wrap">
                    <?php if ($image_url !== ''): ?>
                        <img class="wfa-image" src="<?= e($image_url) ?>" alt="">
                    <?php else: ?>
                        <div class="wfa-no-image">No image available</div>
                    <?php endif; ?>
                </div>

                <?php if ($qr_url !== ''): ?>
                    <a class="wfa-qr" href="<?= e($article_url) ?>" target="_blank" rel="noopener noreferrer">
                        <img src="<?= e($qr_url) ?>" alt="QR code linking to this article">
                        <span>Scan to read</span>
                    </a>
                <?php endif; ?>

                <?php if ($article_url !== ''): ?>
                    <a class="wfa-link" href="<?= e($article_url) ?>" target="_blank" rel="noopener noreferrer">Read on Wikipedia</a>
                <?php endif; ?>
            </aside>
        </main>

        <footer class="wfa-footer">
            <span><?= e($title) ?></span>
            <span class="wfa-footer__source">Wikimedia feed</span>
        </footer>
    </div>
<?php endif; ?>
