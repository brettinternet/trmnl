@php
    $calendar = data_get($data, 'data.user.contributionsCollection.contributionCalendar');
    $errors = data_get($data, 'errors');
    $username = data_get($config, 'username', data_get($trmnl, 'plugin_settings.custom_fields_values.username', 'GitHub'));

    $weeks = is_array($calendar['weeks'] ?? null) ? $calendar['weeks'] : [];
    $days = [];

    foreach ($weeks as $week) {
        foreach (($week['contributionDays'] ?? []) as $day) {
            $days[] = [
                'count' => (int) ($day['contributionCount'] ?? 0),
                'date' => (string) ($day['date'] ?? ''),
            ];
        }
    }

    usort($days, fn ($a, $b) => strcmp($a['date'], $b['date']));

    $longestStreak = 0;
    $runningStreak = 0;
    $maxContributions = 0;
    $totalContributionsFromDays = 0;

    foreach ($days as $day) {
        $count = $day['count'];
        $totalContributionsFromDays += $count;
        $maxContributions = max($maxContributions, $count);

        if ($count > 0) {
            $runningStreak++;
            $longestStreak = max($longestStreak, $runningStreak);
        } else {
            $runningStreak = 0;
        }
    }

    $currentStreak = 0;
    for ($i = count($days) - 1; $i >= 0; $i--) {
        if ($days[$i]['count'] === 0) {
            break;
        }

        $currentStreak++;
    }

    $averageContributions = count($days) > 0
        ? number_format($totalContributionsFromDays / count($days), 2)
        : '0.00';

    $totalContributions = (int) ($calendar['totalContributions'] ?? $totalContributionsFromDays);

    $shadeFor = function (int $count): string {
        return match (true) {
            $count === 0 => 'github-graph__day--0',
            $count === 1 => 'github-graph__day--1',
            $count === 2 => 'github-graph__day--2',
            $count === 3 => 'github-graph__day--3',
            $count === 4 => 'github-graph__day--4',
            $count === 5 => 'github-graph__day--5',
            $count === 6 => 'github-graph__day--6',
            $count <= 8 => 'github-graph__day--7',
            $count <= 10 => 'github-graph__day--8',
            $count <= 12 => 'github-graph__day--9',
            $count <= 15 => 'github-graph__day--10',
            $count <= 20 => 'github-graph__day--11',
            default => 'github-graph__day--12',
        };
    };
@endphp

<style>
    .github-graph {
        display: grid;
        grid-template-columns: repeat(53, 1fr);
        grid-template-rows: repeat(7, 1fr);
        grid-auto-flow: column;
        gap: 3px;
        width: 100%;
    }

    .github-graph__day {
        aspect-ratio: 1;
        border-radius: 1px;
    }

    .github-graph__day--0 { background: #f1f1f1; }
    .github-graph__day--1 { background: #d8d8d8; }
    .github-graph__day--2 { background: #cccccc; }
    .github-graph__day--3 { background: #c0c0c0; }
    .github-graph__day--4 { background: #b5b5b5; }
    .github-graph__day--5 { background: #a9a9a9; }
    .github-graph__day--6 { background: #9d9d9d; }
    .github-graph__day--7 { background: #858585; }
    .github-graph__day--8 { background: #6e6e6e; }
    .github-graph__day--9 { background: #575757; }
    .github-graph__day--10 { background: #404040; }
    .github-graph__day--11 { background: #242424; }
    .github-graph__day--12 { background: #000000; }
</style>

@if ($errors || ! $calendar)
    <div class="view view--full">
        <div class="layout layout--col gap--space-between">
            <div class="item">
                <div class="meta"></div>
                <div class="content">
                    <span class="value value--large">GitHub unavailable</span>
                    <span class="label">Check username and token configuration</span>
                </div>
            </div>
        </div>

        <div class="title_bar">
            <span class="title">GitHub</span>
            <span class="instance">{{ $username }}</span>
        </div>
    </div>
@else
    <div class="view view--full">
        <div class="layout layout--col gap--space-between">
            <div class="grid grid--cols-2">
                <div class="item">
                    <div class="meta"></div>
                    <div class="content">
                        <span class="value value--tnums value--xxxlarge">{{ number_format($totalContributions) }}</span>
                        <span class="label">Contributions in last year</span>
                    </div>
                </div>

                <div class="flex flex--col gap--medium">
                    <div class="grid grid--cols-2">
                        <div class="item">
                            <div class="meta"></div>
                            <div class="content">
                                <span class="value value--tnums">{{ $longestStreak }}</span>
                                <span class="label">Longest streak</span>
                            </div>
                        </div>

                        <div class="item">
                            <div class="meta"></div>
                            <div class="content">
                                <span class="value value--tnums">{{ $currentStreak }}</span>
                                <span class="label">Current streak</span>
                            </div>
                        </div>
                    </div>

                    <div class="divider"></div>

                    <div class="grid grid--cols-2">
                        <div class="item">
                            <div class="meta"></div>
                            <div class="content">
                                <span class="value value--tnums">{{ $maxContributions }}</span>
                                <span class="label">Most in a day</span>
                            </div>
                        </div>

                        <div class="item">
                            <div class="meta"></div>
                            <div class="content">
                                <span class="value value--tnums">{{ $averageContributions }}</span>
                                <span class="label">Average per day</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="divider"></div>

            <div class="github-graph">
                @foreach ($weeks as $week)
                    @foreach (($week['contributionDays'] ?? []) as $day)
                        <span class="github-graph__day {{ $shadeFor((int) ($day['contributionCount'] ?? 0)) }}"></span>
                    @endforeach
                @endforeach
            </div>
        </div>

        <div class="title_bar">
            <span class="title">GitHub</span>
            <span class="instance">{{ $username }}</span>
        </div>
    </div>
@endif
