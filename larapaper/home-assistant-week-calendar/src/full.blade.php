@php
    use Carbon\Carbon;

    $customFields = data_get($trmnl ?? null, 'plugin_settings.custom_fields_values', []);
    $tz = data_get($config ?? [], 'timezone', data_get($customFields, 'timezone', 'America/Denver'));
    $viewMode = data_get($config ?? [], 'calendar_view', data_get($customFields, 'calendar_view', 'current_week'));

    try {
        $now = Carbon::now($tz);
    } catch (\Throwable $e) {
        $tz = 'UTC';
        $now = Carbon::now($tz);
    }

    $today = $now->copy()->startOfDay();
    $calendarStart = $viewMode === 'next_3_days'
        ? $today->copy()
        : $today->copy()->startOfWeek(Carbon::SUNDAY);
    $dayCount = $viewMode === 'next_3_days' ? 3 : 7;

    $days = collect(range(0, $dayCount - 1))->map(function ($offset) use ($calendarStart, $today) {
        $date = $calendarStart->copy()->addDays($offset);

        return [
            'date' => $date,
            'is_today' => $date->isSameDay($today),
        ];
    });

    $payload = $data ?? [];
    $rawEvents = data_get($payload, 'data');

    if ($rawEvents === null && is_array($payload)) {
        $rawEvents = $payload;
    }

    $events = collect(is_array($rawEvents) ? $rawEvents : [])->map(function ($event) use ($tz) {
        $startRaw = data_get($event, 'start.dateTime') ?? data_get($event, 'start.date');
        $endRaw = data_get($event, 'end.dateTime') ?? data_get($event, 'end.date');

        if (!$startRaw || !$endRaw) {
            return null;
        }

        $dateOnly = data_get($event, 'start.date') && !data_get($event, 'start.dateTime');

        try {
            $start = $dateOnly
                ? Carbon::parse(data_get($event, 'start.date'), $tz)->startOfDay()
                : Carbon::parse(data_get($event, 'start.dateTime'))->tz($tz);
            $end = $dateOnly
                ? Carbon::parse(data_get($event, 'end.date'), $tz)->startOfDay()
                : Carbon::parse(data_get($event, 'end.dateTime'))->tz($tz);
        } catch (\Throwable $e) {
            return null;
        }

        if (!$end->gt($start)) {
            return null;
        }

        $midnightSpan = $start->format('H:i') === '00:00'
            && $end->format('H:i') === '00:00'
            && $end->gt($start);

        return [
            'summary' => data_get($event, 'summary', 'Untitled'),
            'location' => data_get($event, 'location', ''),
            'start' => $start,
            'end' => $end,
            'all_day' => $dateOnly || $midnightSpan,
        ];
    })->filter()->sortBy('start')->values();

    $occursOn = function ($event, Carbon $date) {
        $dayStart = $date->copy()->startOfDay();
        $dayEnd = $dayStart->copy()->addDay();

        return $event['start']->lt($dayEnd) && $event['end']->gt($dayStart);
    };

    $visibleTimedEvents = $events->filter(function ($event) use ($days, $occursOn) {
        return !$event['all_day'] && $days->contains(fn ($day) => $occursOn($event, $day['date']));
    });

    $windowStartHour = 7;
    $windowEndHour = 21;

    foreach ($days as $day) {
        $dayStart = $day['date']->copy()->startOfDay();
        $dayEnd = $dayStart->copy()->addDay();

        foreach ($visibleTimedEvents->filter(fn ($event) => $occursOn($event, $day['date'])) as $event) {
            $segmentStart = $event['start']->gt($dayStart) ? $event['start'] : $dayStart;
            $segmentEnd = $event['end']->lt($dayEnd) ? $event['end'] : $dayEnd;
            $startMinute = $dayStart->diffInMinutes($segmentStart, false);
            $endMinute = $dayStart->diffInMinutes($segmentEnd, false);

            $windowStartHour = min($windowStartHour, (int) floor($startMinute / 60));
            $windowEndHour = max($windowEndHour, (int) ceil($endMinute / 60));
        }
    }

    $windowStartHour = max(0, $windowStartHour);
    $windowEndHour = min(24, $windowEndHour);
    $windowStartMinute = $windowStartHour * 60;
    $windowMinutes = max(60, ($windowEndHour - $windowStartHour) * 60);
    $hourStep = $windowMinutes > 900 ? 2 : 1;
    $hourMarks = range($windowStartHour, $windowEndHour, $hourStep);

    $allDayByDay = [];
    $timedByDay = [];
    $maxAllDayRows = 0;

    foreach ($days as $index => $day) {
        $date = $day['date'];
        $allDayByDay[$index] = $events
            ->filter(fn ($event) => $event['all_day'] && $occursOn($event, $date))
            ->values();
        $maxAllDayRows = max($maxAllDayRows, min(3, $allDayByDay[$index]->count()));

        $dayStart = $date->copy()->startOfDay();
        $items = $events
            ->filter(fn ($event) => !$event['all_day'] && $occursOn($event, $date))
            ->map(function ($event) use ($dayStart, $windowStartMinute, $windowMinutes) {
                $start = max($windowStartMinute, $dayStart->diffInMinutes($event['start'], false));
                $end = min($windowStartMinute + $windowMinutes, $dayStart->diffInMinutes($event['end'], false));

                return array_merge($event, [
                    'start_minute' => $start,
                    'end_minute' => max($start + 15, $end),
                ]);
            })
            ->sortBy('start_minute')
            ->values()
            ->all();

        $group = -1;
        $groupEnd = -1;
        $laneEnds = [];
        $groupLaneCounts = [];

        foreach ($items as $itemIndex => $item) {
            if ($item['start_minute'] >= $groupEnd) {
                $group++;
                $groupEnd = $item['end_minute'];
                $laneEnds = [];
            } else {
                $groupEnd = max($groupEnd, $item['end_minute']);
            }

            $lane = 0;
            while (isset($laneEnds[$lane]) && $laneEnds[$lane] > $item['start_minute']) {
                $lane++;
            }

            $laneEnds[$lane] = $item['end_minute'];
            $items[$itemIndex]['group'] = $group;
            $items[$itemIndex]['lane'] = $lane;
            $groupLaneCounts[$group] = max($groupLaneCounts[$group] ?? 1, $lane + 1);
        }

        foreach ($items as $itemIndex => $item) {
            $items[$itemIndex]['lane_count'] = $groupLaneCounts[$item['group']];
        }

        $timedByDay[$index] = $items;
    }

    $allDayHeight = $maxAllDayRows > 0 ? 18 + ($maxAllDayRows * 19) : 0;
    $gridHeight = 322 - $allDayHeight;
    $formatHour = fn ($hour) => Carbon::createFromTime($hour % 24, 0)->format('g A');
@endphp

<style>
    .week-calendar { height: 100%; overflow: hidden; }
    .week-calendar__header,
    .week-calendar__all-day,
    .week-calendar__body { display: grid; grid-template-columns: 42px repeat({{ $dayCount }}, minmax(0, 1fr)); }
    .week-calendar__header { height: 45px; border-bottom: 1px solid #777; }
    .week-calendar__corner { display: flex; align-items: center; font-size: 13px; font-weight: 600; }
    .week-calendar__day-heading { display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #bbb; }
    .week-calendar__day-name { font-size: 11px; text-transform: uppercase; }
    .week-calendar__day-number { margin-top: 2px; font-size: 18px; font-weight: 600; line-height: 20px; }
    .week-calendar__day-number--today { width: 25px; border-radius: 50%; background: #000; color: #fff; text-align: center; }
    .week-calendar__all-day { height: {{ $allDayHeight }}px; border-bottom: 1px solid #777; }
    .week-calendar__all-day-label { padding-top: 4px; color: #555; font-size: 8px; text-transform: uppercase; }
    .week-calendar__all-day-column { min-width: 0; padding: 2px; border-left: 1px solid #bbb; overflow: hidden; }
    .week-calendar__all-day-event { height: 17px; margin-bottom: 2px; padding: 1px 3px; overflow: hidden; border-radius: 2px; background: #333; color: #fff; font-size: 9px; font-weight: 600; line-height: 15px; text-overflow: ellipsis; white-space: nowrap; }
    .week-calendar__body { height: {{ $gridHeight }}px; }
    .week-calendar__times { position: relative; }
    .week-calendar__time { position: absolute; right: 5px; transform: translateY(-50%); color: #555; font-size: 8px; white-space: nowrap; }
    .week-calendar__time:first-child { transform: none; }
    .week-calendar__day { position: relative; min-width: 0; border-left: 1px solid #999; }
    .week-calendar__hour-line { position: absolute; right: 0; left: 0; border-top: 1px solid #ddd; }
    .week-calendar__event { position: absolute; min-height: 12px; padding: 2px 3px; overflow: hidden; border-left: 3px solid #000; border-radius: 2px; background: #d5d5d5; color: #000; font-size: 9px; line-height: 10px; }
    .week-calendar__event-time { display: block; font-size: 7px; font-weight: 400; white-space: nowrap; }
    .week-calendar__event-title { display: block; font-weight: 700; }
    .week-calendar__empty { display: flex; height: {{ $gridHeight }}px; align-items: center; justify-content: center; color: #555; font-size: 14px; }
</style>

@props(['size' => 'full'])
<x-trmnl::view size="{{ $size }}">
    <x-trmnl::layout class="layout--col layout--top week-calendar p--2 gap--none">
        <div class="week-calendar__header w--full">
            <div class="week-calendar__corner">{{ $calendarStart->format('M Y') }}</div>
            @foreach($days as $day)
                <div class="week-calendar__day-heading">
                    <span class="week-calendar__day-name">{{ $day['date']->format('D') }}</span>
                    <span class="week-calendar__day-number @if($day['is_today']) week-calendar__day-number--today @endif">{{ $day['date']->format('j') }}</span>
                </div>
            @endforeach
        </div>

        @if($maxAllDayRows > 0)
            <div class="week-calendar__all-day w--full">
                <div class="week-calendar__all-day-label">all-day</div>
                @foreach($days as $index => $day)
                    <div class="week-calendar__all-day-column">
                        @foreach($allDayByDay[$index]->take($allDayByDay[$index]->count() > 3 ? 2 : 3) as $event)
                            <div class="week-calendar__all-day-event">{{ $event['summary'] }}</div>
                        @endforeach
                        @if($allDayByDay[$index]->count() > 3)
                            <div class="week-calendar__all-day-event">+{{ $allDayByDay[$index]->count() - 2 }} more</div>
                        @endif
                    </div>
                @endforeach
            </div>
        @endif

        @if($visibleTimedEvents->isEmpty() && $maxAllDayRows === 0)
            <div class="week-calendar__empty w--full">No events in this view</div>
        @else
            <div class="week-calendar__body w--full">
                <div class="week-calendar__times">
                    @foreach($hourMarks as $hour)
                        @php $top = (($hour * 60 - $windowStartMinute) / $windowMinutes) * 100; @endphp
                        <span class="week-calendar__time" style="top: {{ $top }}%;">{{ $formatHour($hour) }}</span>
                    @endforeach
                </div>

                @foreach($days as $index => $day)
                    <div class="week-calendar__day">
                        @foreach($hourMarks as $hour)
                            @php $top = (($hour * 60 - $windowStartMinute) / $windowMinutes) * 100; @endphp
                            <span class="week-calendar__hour-line" style="top: {{ $top }}%;"></span>
                        @endforeach

                        @foreach($timedByDay[$index] as $event)
                            @php
                                $top = (($event['start_minute'] - $windowStartMinute) / $windowMinutes) * 100;
                                $height = (($event['end_minute'] - $event['start_minute']) / $windowMinutes) * 100;
                                $width = 100 / $event['lane_count'];
                                $left = $event['lane'] * $width;
                            @endphp
                            <div class="week-calendar__event" style="top: {{ $top }}%; height: {{ $height }}%; left: {{ $left }}%; width: {{ $width }}%;">
                                <span class="week-calendar__event-time">{{ $event['start']->format('g:i A') }}</span>
                                <span class="week-calendar__event-title">{{ $event['summary'] }}</span>
                            </div>
                        @endforeach
                    </div>
                @endforeach
            </div>
        @endif
    </x-trmnl::layout>
</x-trmnl::view>
