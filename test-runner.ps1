# AskMe AI Test Runner (PowerShell)
# Simple test script for Windows users

param(
    [string]$Scenario = "basic",
    [switch]$Verbose,
    [int]$Delay = 1000,
    [string]$BaseUrl = "http://localhost:3000",
    [string]$TestEmail = "deeshop9821@gmail.com"
)

Write-Host "🤖 AskMe AI Test Runner (PowerShell)" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "📋 Scenario: $Scenario" -ForegroundColor Yellow
Write-Host "🔊 Verbose: $Verbose" -ForegroundColor Yellow
Write-Host "⏱️  Delay: ${Delay}ms" -ForegroundColor Yellow
Write-Host ""

# Function to send HTTP request
function Send-TestMessage {
    param(
        [string]$Message,
        [string]$TestName = "Test Message"
    )
    
    Write-Host "🧪 $TestName" -ForegroundColor Blue
    Write-Host "📝 Message: $($Message.Substring(0, [Math]::Min(80, $Message.Length)))$(if ($Message.Length -gt 80) { '...' })" -ForegroundColor Gray
    
    $body = @{
        email = $TestEmail
        message = $Message
    } | ConvertTo-Json
    
    $headers = @{
        "Content-Type" = "application/json"
        "User-Agent" = "AskMe-AI-Tester-PS/1.0"
    }
    
    try {
        $startTime = Get-Date
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/gptRouter" -Method POST -Body $body -Headers $headers
        $endTime = Get-Date
        $responseTime = ($endTime - $startTime).TotalMilliseconds
        
        if ($response.success) {
            Write-Host "✅ Success (${responseTime}ms, $($response.response.Length) chars)" -ForegroundColor Green
            
            if ($response.chunked) {
                Write-Host "📦 Response was chunked into $($response.chunks.Length) parts" -ForegroundColor Magenta
            }
            
            if ($response.tokensUsed -gt 0) {
                Write-Host "🪙 Tokens used: $($response.tokensUsed), remaining: $($response.tokensRemaining)" -ForegroundColor Yellow
            }
            
            if ($Verbose -and $response.response) {
                Write-Host "📄 Response preview: $($response.response.Substring(0, [Math]::Min(200, $response.response.Length)))$(if ($response.response.Length -gt 200) { '...' })" -ForegroundColor Gray
            }
        } else {
            Write-Host "❌ Failed: $($response.error)" -ForegroundColor Red
        }
        
        return $response
    }
    catch {
        Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Function to check if user exists
function Test-UserExists {
    try {
        Write-Host "🔍 Checking if test user exists..." -ForegroundColor Blue
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/gptRouter?email=$TestEmail" -Method GET
        
        if ($response.id) {
            Write-Host "✅ Test user found: $($response.firstName) (ID: $($response.id))" -ForegroundColor Green
            return $true
        } else {
            Write-Host "⚠️ Test user not found. Please create user first." -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "❌ Error checking user: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test scenarios
function Run-Scenario1 {
    Write-Host "`n=== SCENARIO 1: Initial Greeting & Context Recognition ===" -ForegroundColor Cyan
    
    Send-TestMessage -Message "__INIT_CHAT__" -TestName "Initialization Test"
    Start-Sleep -Milliseconds $Delay
    
    Send-TestMessage -Message "Hi! I'm feeling a bit overwhelmed today and could use some guidance." -TestName "Stress Management Follow-up"
}

function Run-Scenario2 {
    Write-Host "`n=== SCENARIO 2: Long Response Chunking ===" -ForegroundColor Cyan
    
    $complexRequest = "Can you give me a comprehensive daily routine that incorporates all my wellness goals? I want something detailed that covers morning, afternoon, and evening activities, including specific exercises, meal planning tips, stress management techniques, and sleep hygiene practices. Please be very thorough and include timeframes and explanations for each recommendation."
    
    Send-TestMessage -Message $complexRequest -TestName "Comprehensive Daily Routine Request"
}

function Run-Scenario3 {
    Write-Host "`n=== SCENARIO 3: Context Retention Test ===" -ForegroundColor Cyan
    
    Send-TestMessage -Message "That routine looks great! But I'm particularly struggling with the morning part you mentioned. What if I'm not a morning person?" -TestName "Morning Routine Context Test"
    Start-Sleep -Milliseconds $Delay
    
    Send-TestMessage -Message "Also, how does this help with my emotional eating issue specifically?" -TestName "Emotional Eating Context Test"
}

function Run-TokenTest {
    Write-Host "`n=== TOKEN MANAGEMENT TEST ===" -ForegroundColor Cyan
    
    Send-TestMessage -Message "How many tokens do I have left?" -TestName "Token Balance Check"
}

function Run-ChunkingTest {
    Write-Host "`n=== CHUNKING STRESS TEST ===" -ForegroundColor Cyan
    
    $veryLongRequest = "I need an extremely comprehensive, detailed, and thorough wellness plan that covers every single aspect of health and wellness imaginable. Please include detailed daily schedules for every day of the week, comprehensive meal plans with exact recipes and nutritional breakdowns, complete exercise routines with detailed instructions and progressions, stress management techniques with step-by-step guides, sleep optimization strategies with environmental considerations, mindfulness and meditation practices with various techniques, work-life balance strategies, time management systems, goal setting frameworks, habit formation methodologies, nutrition science explanations, exercise physiology details, mental health considerations, social wellness aspects, spiritual wellness elements, financial wellness connections, environmental wellness factors, and preventive health measures."
    
    Send-TestMessage -Message $veryLongRequest -TestName "Extreme Chunking Test"
}

function Run-EdgeCaseTests {
    Write-Host "`n=== EDGE CASE TESTS ===" -ForegroundColor Cyan
    
    Send-TestMessage -Message "yes" -TestName "Short Message Test"
    Start-Sleep -Milliseconds 500
    
    Send-TestMessage -Message "Can you explain that thing you mentioned before about the thing?" -TestName "Ambiguous Reference Test"
    Start-Sleep -Milliseconds 500
    
    Send-TestMessage -Message "Can you help me with my goals? 😔 I'm struggling with emotional eating 📈" -TestName "Special Characters Test"
}

# Main execution
$userExists = Test-UserExists
if (-not $userExists) {
    Write-Host "❌ Please create the test user first or check if the server is running." -ForegroundColor Red
    exit 1
}

$startTime = Get-Date

# Run tests based on scenario
switch ($Scenario.ToLower()) {
    "basic" {
        Run-Scenario1
        Start-Sleep -Milliseconds $Delay
        Run-Scenario2
        Start-Sleep -Milliseconds $Delay
        Run-TokenTest
    }
    "full" {
        Run-Scenario1
        Start-Sleep -Milliseconds $Delay
        Run-Scenario2
        Start-Sleep -Milliseconds $Delay
        Run-Scenario3
        Start-Sleep -Milliseconds $Delay
        Run-TokenTest
        Start-Sleep -Milliseconds $Delay
        Run-ChunkingTest
        Start-Sleep -Milliseconds $Delay
        Run-EdgeCaseTests
    }
    "chunking" {
        Run-ChunkingTest
    }
    "tokens" {
        Run-TokenTest
    }
    "edge" {
        Run-EdgeCaseTests
    }
    "scenario-1" {
        Run-Scenario1
    }
    "scenario-2" {
        Run-Scenario2
    }
    "scenario-3" {
        Run-Scenario3
    }
    default {
        Write-Host "❌ Unknown scenario: $Scenario" -ForegroundColor Red
        Write-Host "Available scenarios: basic, full, chunking, tokens, edge, scenario-1, scenario-2, scenario-3" -ForegroundColor Yellow
        exit 1
    }
}

$endTime = Get-Date
$totalTime = ($endTime - $startTime).TotalSeconds

Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "📊 TEST EXECUTION COMPLETED" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Cyan
Write-Host "⏱️ Total Time: $([math]::Round($totalTime, 2))s" -ForegroundColor Yellow
Write-Host "📋 Scenario: $Scenario completed" -ForegroundColor Green
Write-Host "💡 Check the console output above for individual test results" -ForegroundColor Yellow
Write-Host "="*60 -ForegroundColor Cyan
