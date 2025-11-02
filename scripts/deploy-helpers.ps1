# PowerShell Deployment Helper Functions
# Add these to your PowerShell profile or run: . .\scripts\deploy-helpers.ps1

# Create a new feature branch and push for preview deployment
function New-FeatureBranch {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FeatureName
    )
    
    $branchName = "feature/$FeatureName"
    
    Write-Host "🌿 Creating feature branch: $branchName" -ForegroundColor Cyan
    
    # Ensure we're on main and up to date
    git checkout main
    git pull origin main
    
    # Create and checkout new branch
    git checkout -b $branchName
    
    Write-Host "✅ Branch created! Make your changes and commit." -ForegroundColor Green
    Write-Host "   Then run: git push origin $branchName" -ForegroundColor Yellow
    Write-Host "   This will create a preview deployment in Vercel." -ForegroundColor Yellow
}

# Push feature branch for preview deployment
function Push-FeatureBranch {
    param(
        [string]$BranchName = ""
    )
    
    if ([string]::IsNullOrEmpty($BranchName)) {
        $BranchName = git rev-parse --abbrev-ref HEAD
    }
    
    Write-Host "📤 Pushing $BranchName to origin..." -ForegroundColor Cyan
    
    # Run pre-deploy checks first
    Write-Host "🔍 Running pre-deployment checks..." -ForegroundColor Yellow
    npm run pre-deploy
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Pre-deployment checks failed!" -ForegroundColor Red
        Write-Host "   Fix errors before pushing." -ForegroundColor Red
        return
    }
    
    git push origin $BranchName
    
    Write-Host "✅ Pushed to origin!" -ForegroundColor Green
    Write-Host "🔗 Check Vercel dashboard for preview URL" -ForegroundColor Yellow
}

# Deploy to production (merge to main and push)
function Deploy-Production {
    param(
        [Parameter(Mandatory=$true)]
        [string]$BranchName
    )
    
    Write-Host "🚀 Deploying to production..." -ForegroundColor Cyan
    
    # Run pre-deploy checks
    Write-Host "🔍 Running pre-deployment checks..." -ForegroundColor Yellow
    npm run pre-deploy
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Pre-deployment checks failed!" -ForegroundColor Red
        return
    }
    
    # Ensure we're on main
    $currentBranch = git rev-parse --abbrev-ref HEAD
    if ($currentBranch -ne "main") {
        Write-Host "📥 Switching to main branch..." -ForegroundColor Yellow
        git checkout main
        git pull origin main
    } else {
        git pull origin main
    }
    
    # Merge feature branch
    Write-Host "🔀 Merging $BranchName into main..." -ForegroundColor Yellow
    git merge $BranchName --no-ff -m "Merge $BranchName into main"
    
    # Push to production
    Write-Host "📤 Pushing to production..." -ForegroundColor Yellow
    git push origin main
    
    Write-Host "✅ Production deployment triggered!" -ForegroundColor Green
    Write-Host "🔗 Monitor deployment: https://vercel.com" -ForegroundColor Yellow
    Write-Host "🌐 Production URL: https://labelcheck.io" -ForegroundColor Yellow
}

# Quick deploy workflow: create branch, commit, push for preview
function Quick-Preview {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FeatureName,
        
        [Parameter(Mandatory=$true)]
        [string]$CommitMessage
    )
    
    Write-Host "⚡ Quick preview deployment workflow" -ForegroundColor Cyan
    
    # Create branch
    New-FeatureBranch -FeatureName $FeatureName
    
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Make your changes"
    Write-Host "   2. Stage: git add ."
    Write-Host "   3. Commit: git commit -m '$CommitMessage'"
    Write-Host "   4. Push: Push-FeatureBranch"
}

# Show deployment status
function Show-DeploymentStatus {
    Write-Host "📊 Deployment Status" -ForegroundColor Cyan
    Write-Host ""
    
    # Current branch
    $currentBranch = git rev-parse --abbrev-ref HEAD
    Write-Host "Current branch: $currentBranch" -ForegroundColor Yellow
    
    # Check if branch exists on remote
    $remoteBranch = git ls-remote --heads origin $currentBranch
    if ($remoteBranch) {
        Write-Host "Remote branch: ✅ exists" -ForegroundColor Green
        Write-Host "   Preview URL should be available in Vercel dashboard" -ForegroundColor Gray
    } else {
        Write-Host "Remote branch: ❌ not pushed yet" -ForegroundColor Red
    }
    
    Write-Host ""
    
    # Uncommitted changes
    $changes = git status --porcelain
    if ($changes) {
        Write-Host "Uncommitted changes: ⚠️  Yes" -ForegroundColor Yellow
        Write-Host $changes
    } else {
        Write-Host "Uncommitted changes: ✅ None" -ForegroundColor Green
    }
    
    Write-Host ""
    
    # Unpushed commits
    $unpushed = git log origin/$currentBranch..HEAD --oneline 2>$null
    if ($unpushed) {
        Write-Host "Unpushed commits: ⚠️  Yes" -ForegroundColor Yellow
        Write-Host $unpushed
    } else {
        Write-Host "Unpushed commits: ✅ None" -ForegroundColor Green
    }
}

# Export functions
Export-ModuleMember -Function New-FeatureBranch, Push-FeatureBranch, Deploy-Production, Quick-Preview, Show-DeploymentStatus

Write-Host "✅ Deployment helpers loaded!" -ForegroundColor Green
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  New-FeatureBranch <name>  - Create new feature branch"
Write-Host "  Push-FeatureBranch        - Push current branch for preview"
Write-Host "  Deploy-Production <branch> - Merge and deploy to production"
Write-Host "  Quick-Preview <name> <msg> - Quick workflow"
Write-Host "  Show-DeploymentStatus    - Show current status"
Write-Host ""

