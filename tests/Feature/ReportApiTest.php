<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\Support\PharmaFixtures;
use Tests\TestCase;

class ReportApiTest extends TestCase
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

    public function test_guest_cannot_access_reports(): void
    {
        $this->getJson('/api/reports/prescriptions-by-date?date_from=2026-01-01&date_to=2026-01-31&granularity=daily')
            ->assertUnauthorized();
    }

    public function test_pharmacist_forbidden_on_reports(): void
    {
        $user = User::factory()->create([
            'username' => 'rep_pharm',
            'password' => Hash::make('password'),
            'role' => 'pharmacist',
        ]);
        $this->loginAs($user);

        $this->getJson('/api/reports/stock')->assertForbidden();
    }

    public function test_manager_prescriptions_by_date(): void
    {
        $manager = User::factory()->create([
            'username' => 'rep_mgr',
            'password' => Hash::make('password'),
            'role' => 'manager',
        ]);
        $this->loginAs($manager);

        $customer = Customer::factory()->create();
        $pharmacist = User::factory()->create(['role' => 'pharmacist']);

        $today = Carbon::parse('2026-04-14 10:00:00');
        Carbon::setTestNow($today);

        Prescription::query()->create([
            'customer_id' => $customer->id,
            'pharmacist_id' => $pharmacist->id,
            'status' => 'dispensed',
            'notes' => null,
        ]);
        Prescription::query()->create([
            'customer_id' => $customer->id,
            'pharmacist_id' => $pharmacist->id,
            'status' => 'rejected',
            'notes' => null,
        ]);

        $dayStr = $today->format('Y-m-d');
        $res = $this->getJson('/api/reports/prescriptions-by-date?date_from='.$dayStr.'&date_to='.$dayStr.'&granularity=daily')
            ->assertOk();

        Carbon::setTestNow();

        $data = $res->json('data');
        $this->assertIsArray($data);
        $this->assertNotEmpty($data);
        $day = $data[0];
        $this->assertSame($dayStr, $day['date']);
        $this->assertSame(2, $day['total']);
        $this->assertSame(1, $day['dispensed']);
        $this->assertSame(1, $day['rejected']);
        $this->assertCount(2, $day['items']);
    }

    public function test_prescriptions_by_customer_flags_irregularity(): void
    {
        $manager = User::factory()->create([
            'username' => 'rep_mgr2',
            'password' => Hash::make('password'),
            'role' => 'manager',
        ]);
        $this->loginAs($manager);

        $customer = Customer::factory()->create();
        $pharmacist = User::factory()->create(['role' => 'pharmacist']);
        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Flag Med',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);

        $base = now()->startOfDay();
        for ($i = 0; $i < 3; $i++) {
            $rx = Prescription::query()->create([
                'customer_id' => $customer->id,
                'pharmacist_id' => $pharmacist->id,
                'status' => 'dispensed',
                'notes' => null,
                'created_at' => $base->copy()->addDays($i * 5),
            ]);
            PrescriptionItem::query()->create([
                'prescription_id' => $rx->id,
                'package_id' => $fix['package']->id,
                'quantity' => 1,
                'dispensed_qty' => 1,
            ]);
        }

        $res = $this->getJson('/api/reports/prescriptions-by-customer?customer_id='.$customer->id)
            ->assertOk();

        $prescriptions = $res->json('data.prescriptions');
        $this->assertCount(3, $prescriptions);
        $third = $prescriptions[0];
        $this->assertTrue($third['items'][0]['flagged']);
    }

    public function test_stock_report_json_and_csv(): void
    {
        $admin = User::factory()->create([
            'username' => 'rep_adm',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        $this->loginAs($admin);

        $fix = PharmaFixtures::medicineWithPackage([
            'name' => 'Stock Med',
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ]);
        PharmaFixtures::inventoryForPackage($fix['package'], [
            'quantity' => 5,
            'expiry_date' => now()->addYear()->toDateString(),
        ]);

        $this->getJson('/api/reports/stock')
            ->assertOk()
            ->assertJsonPath('data.summary.total_medicines', 1)
            ->assertJsonPath('data.rows.0.status', 'LOW_STOCK');

        $this->get('/api/reports/stock?export=csv')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }
}
