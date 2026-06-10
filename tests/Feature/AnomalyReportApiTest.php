<?php

namespace Tests\Feature;

use App\Models\AgeVerificationLog;
use App\Models\Customer;
use App\Models\MedicationHistory;
use App\Models\Prescription;
use App\Models\User;
use App\Support\AnomalyThresholds;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Support\PharmaFixtures;
use Tests\TestCase;

class AnomalyReportApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ValidateCsrfToken::class);
        $this->withCredentials();
        $this->withHeaders([
            'Origin' => 'http://localhost',
        ]);
    }

    protected function rememberSessionCookieFrom(TestResponse $response): void
    {
        $cookie = $response->getCookie(config('session.cookie'));

        if ($cookie !== null) {
            $this->withCookie(config('session.cookie'), $cookie->getValue());
        }
    }

    protected function loginAs(User $user): void
    {
        $this->rememberSessionCookieFrom($this->get('/sanctum/csrf-cookie'));
        $this->rememberSessionCookieFrom(
            $this->postJson('/api/login', [
                'username' => $user->username,
                'password' => 'password',
            ])->assertOk()
        );
    }

    public function test_guest_cannot_access_anomaly_report(): void
    {
        $this->getJson('/api/reports/anomaly')->assertUnauthorized();
    }

    public function test_pharmacist_forbidden_on_anomaly_report(): void
    {
        $user = User::factory()->create([
            'username' => 'anom_pharm',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $this->getJson('/api/reports/anomaly')->assertForbidden();
    }

    public function test_manager_gets_anomaly_report_with_high_frequency_flag(): void
    {
        $manager = User::factory()->create([
            'username' => 'anom_mgr',
            'password' => Hash::make('password'),
            'role' => 'manager',
        ]);
        $this->loginAs($manager);

        $customer = Customer::factory()->create();
        $pharmacist = User::factory()->create(['role' => 'pharmacist']);
        $fix = PharmaFixtures::medicineWithPackage(['name' => 'Freq Med']);
        $base = Carbon::parse('2026-04-10 12:00:00');
        Carbon::setTestNow($base->copy()->addDays(10));

        for ($i = 0; $i < 4; $i++) {
            $rx = Prescription::query()->create([
                'customer_id' => $customer->id,
                'pharmacist_id' => $pharmacist->id,
                'status' => 'dispatched',
                'notes' => null,
            ]);
            MedicationHistory::query()->create([
                'customer_id' => $customer->id,
                'prescription_id' => $rx->id,
                'medicine_id' => $fix['medicine']->id,
                'dispensed_at' => $base->copy()->addDays($i),
                'qty' => 1,
            ]);
        }

        $res = $this->getJson('/api/reports/anomaly?date_from=2026-04-01&date_to=2026-04-30')
            ->assertOk()
            ->assertJsonStructure([
                'summary' => ['total_flags', 'critical', 'high', 'medium', 'date_range', 'generated_at'],
                'flags',
            ]);

        Carbon::setTestNow();

        $flags = $res->json('flags');
        $this->assertNotEmpty($flags);
        $ruleIds = array_column($flags, 'rule_id');
        $this->assertContains(1, $ruleIds);
    }

    public function test_anomaly_csv_export(): void
    {
        $admin = User::factory()->create([
            'username' => 'anom_adm',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        $this->loginAs($admin);

        $this->get('/api/reports/anomaly/export?date_from=2026-01-01&date_to=2026-12-31')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_manager_cannot_update_thresholds(): void
    {
        $manager = User::factory()->create([
            'username' => 'anom_mgr2',
            'password' => Hash::make('password'),
            'role' => 'manager',
        ]);
        $this->loginAs($manager);

        $this->getJson('/api/reports/anomaly/thresholds')->assertOk();
        $this->putJson('/api/reports/anomaly/thresholds', [
            'weekly_volume' => ['default' => 350],
        ])->assertForbidden();
    }

    public function test_admin_can_update_thresholds(): void
    {
        Storage::fake('local');

        $admin = User::factory()->create([
            'username' => 'anom_adm2',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        $this->loginAs($admin);

        $this->putJson('/api/reports/anomaly/thresholds', [
            'weekly_volume' => ['default' => 350],
        ])
            ->assertOk()
            ->assertJsonPath('data.weekly_volume.default', 350);

        $this->assertSame(350, AnomalyThresholds::all()['weekly_volume']['default']);
    }

    public function test_critical_verification_bypass_flag(): void
    {
        $manager = User::factory()->create([
            'username' => 'anom_mgr3',
            'password' => Hash::make('password'),
            'role' => 'manager',
        ]);
        $pharmacist = User::factory()->create(['role' => 'pharmacist']);
        $this->loginAs($manager);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Codeine Mix',
            'requires_age_check' => true,
            'min_age' => 18,
        ]);
        $customer = Customer::factory()->create();
        $now = Carbon::parse('2026-05-31 10:00:00');
        Carbon::setTestNow($now);

        for ($i = 0; $i < 6; $i++) {
            AgeVerificationLog::query()->create([
                'prescription_id' => null,
                'medicine_id' => $fix['medicine']->id,
                'customer_id' => $customer->id,
                'pharmacist_id' => $pharmacist->id,
                'customer_age' => 17,
                'min_age_required' => 18,
                'id_type_presented' => null,
                'outcome' => 'exempted',
                'pharmacist_notes' => 'test',
                'created_at' => $now->copy()->subDays($i),
                'updated_at' => $now->copy()->subDays($i),
            ]);
        }

        $res = $this->getJson('/api/reports/anomaly?date_from=2026-05-01&date_to=2026-05-31')->assertOk();
        Carbon::setTestNow();

        $critical = array_filter($res->json('flags'), fn ($f) => $f['rule_id'] === 5);
        $this->assertNotEmpty($critical);
        $this->assertSame('critical', array_values($critical)[0]['severity']);
    }
}
