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

    $weeks = 52;
    $daysPerWeek = 7;
    $gridStart = $today->copy()->startOfYear()->startOfWeek(Carbon::SUNDAY);
    $yearEnd = $today->copy()->endOfYear()->startOfDay();
    $calendarDays = $gridStart->diffInDays($yearEnd) + 1;
    $calendarWeeks = (int) ceil($calendarDays / $daysPerWeek);

    $weeksForColumn = function (int $column) use ($weeks, $calendarWeeks): array {
        return $column === $weeks - 1
            ? range($column, $calendarWeeks - 1)
            : [$column];
    };

    $stateFor = function (Carbon $date) use ($today, $year): string {
        if ((int) $date->format('Y') !== $year) {
            return 'year-grid__day--outside';
        }

        return match (true) {
            $date->lt($today) => 'year-grid__day--past',
            $date->isSameDay($today) => 'year-grid__day--today',
            default => 'year-grid__day--future',
        };
    };
@endphp

<style>
    .year-grid {
        display: grid;
        grid-template-columns: repeat({{ $weeks }}, 1fr);
        gap: 3px;
        width: 100%;
        align-items: start;
    }

    .year-grid__column {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
    }

    .year-grid__week {
        display: grid;
        grid-template-rows: repeat(7, 1fr);
        gap: 3px;
    }

    .year-grid__day {
        aspect-ratio: 1;
        border-radius: 1px;
    }

    .year-grid__day--past { background: #000000; }

    .year-grid__day--today { background: #707070; }

    .year-grid__day--future {
        background: #d8d8d8;
        box-shadow: inset 0 0 0 1px #9a9a9a;
    }
    .year-grid__day--outside { visibility: hidden; }

    .days-left-this-year .title_bar {
        background: transparent;
    }

    .days-left-this-year .title_bar .title,
    .days-left-this-year .title_bar .instance {
        background: transparent;
        color: #333333;
    }
</style>

<div class="view view--full days-left-this-year">
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
            @for ($column = 0; $column < $weeks; $column++)
                <div class="year-grid__column">
                    @foreach ($weeksForColumn($column) as $week)
                        @php $weekStart = $gridStart->copy()->addWeeks($week); @endphp
                        <div class="year-grid__week">
                            @for ($dayOfWeek = 0; $dayOfWeek < $daysPerWeek; $dayOfWeek++)
                                @php $date = $weekStart->copy()->addDays($dayOfWeek); @endphp
                                <span class="year-grid__day {{ $stateFor($date) }}"></span>
                            @endfor
                        </div>
                    @endforeach
                </div>
            @endfor
        </div>
    </div>

    <div class="title_bar">
        <span class="title">{{ $year }}</span>
        <span class="instance">{{ $percentComplete }}%</span>
    </div>
</div>
