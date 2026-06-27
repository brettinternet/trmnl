@php
    use Carbon\Carbon;

    $tz = data_get($config, 'timezone', data_get($trmnl, 'plugin_settings.custom_fields_values.timezone', 'America/Chicago'));

    try {
        $now = Carbon::now($tz);
    } catch (\Throwable $e) {
        $now = Carbon::now('UTC');
    }

    $today = $now->copy()->startOfDay();
    $year = (int) $today->format('Y');
    $daysInYear = $today->isLeapYear() ? 366 : 365;
    $dayOfYear = $today->dayOfYear; // 1-based: Jan 1 => 1

    $daysPassed = $dayOfYear - 1;              // fully completed days before today
    $daysLeft = $daysInYear - $daysPassed;     // remaining days, today included
    $percentComplete = (int) round($daysPassed / $daysInYear * 100);

    $columns = (int) ceil($daysInYear / 7);

    $stateFor = function (int $dayNumber) use ($dayOfYear): string {
        return match (true) {
            $dayNumber < $dayOfYear => 'year-grid__day--past',
            $dayNumber === $dayOfYear => 'year-grid__day--today',
            default => 'year-grid__day--future',
        };
    };
@endphp

<style>
    .year-grid {
        display: grid;
        grid-template-columns: repeat({{ $columns }}, 1fr);
        grid-template-rows: repeat(7, 1fr);
        grid-auto-flow: column;
        gap: 3px;
        width: 100%;
    }

    .year-grid__day {
        aspect-ratio: 1;
        border-radius: 1px;
    }

    .year-grid__day--past { background: #000000; }

    .year-grid__day--today {
        background: #000000;
        outline: 2px solid #000000;
        outline-offset: 1px;
    }

    .year-grid__day--future {
        background: #ffffff;
        box-shadow: inset 0 0 0 1px #c4c4c4;
    }
</style>

<div class="view view--full">
    <div class="layout layout--col gap--space-between">
        <div class="grid grid--cols-2 w--full">
            <div class="flex flex--col flex--center-x text--center">
                <span class="value value--tnums value--xxxlarge">{{ number_format($daysPassed) }}</span>
                <span class="label">Days Passed</span>
            </div>

            <div class="flex flex--col flex--center-x text--center">
                <span class="value value--tnums value--xxxlarge">{{ number_format($daysLeft) }}</span>
                <span class="label">Days Left</span>
            </div>
        </div>

        <div class="year-grid">
            @for ($day = 1; $day <= $daysInYear; $day++)
                <span class="year-grid__day {{ $stateFor($day) }}"></span>
            @endfor
        </div>
    </div>

    <div class="title_bar">
        <span class="title">{{ $year }}</span>
        <span class="instance">{{ $percentComplete }}% complete</span>
    </div>
</div>
