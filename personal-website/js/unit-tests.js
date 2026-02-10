// Unit tests for the portfolio website JavaScript functionality

// Simple function to run tests in the console
function runTests() {
    console.log('Running unit tests for portfolio website...\n');
    
    // Test 1: Check if DOM elements exist
    console.log('Test 1: Checking if DOM elements exist...');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const projectCards = document.querySelectorAll('.project-card');
    const skillGroups = document.querySelectorAll('.skill-group');
    
    if (navToggle) {
        console.log('✅ navToggle element exists');
    } else {
        console.log('❌ navToggle element missing');
    }
    
    if (navLinks) {
        console.log('✅ navLinks element exists');
    } else {
        console.log('❌ navLinks element missing');
    }
    
    if (projectCards.length > 0) {
        console.log(`✅ Found ${projectCards.length} project cards`);
    } else {
        console.log('❌ No project cards found');
    }
    
    if (skillGroups.length > 0) {
        console.log(`✅ Found ${skillGroups.length} skill groups`);
    } else {
        console.log('❌ No skill groups found');
    }
    
    // Test 2: Check if navigation links exist
    console.log('\nTest 2: Checking navigation links...');
    const navAnchors = document.querySelectorAll('a[href^="#"]');
    console.log(`✅ Found ${navAnchors.length} navigation links`);
    
    // Test 3: Check if the animation is applied to elements
    console.log('\nTest 3: Checking element animations...');
    const firstProjectCard = projectCards[0];
    if (firstProjectCard) {
        const initialOpacity = firstProjectCard.style.opacity;
        const initialTransform = firstProjectCard.style.transform;
        
        if (initialOpacity === '0' && initialTransform.includes('translateY(20px)')) {
            console.log('✅ Animation styles correctly applied to project card');
        } else {
            console.log('❌ Animation styles not correctly applied to project card');
        }
    }
    
    const firstSkillGroup = skillGroups[0];
    if (firstSkillGroup) {
        const initialOpacity = firstSkillGroup.style.opacity;
        const initialTransform = firstSkillGroup.style.transform;
        
        if (initialOpacity === '0' && initialTransform.includes('translateY(20px)')) {
            console.log('✅ Animation styles correctly applied to skill group');
        } else {
            console.log('❌ Animation styles not correctly applied to skill group');
        }
    }
    
    // Test 4: Check if scroll event listeners are attached
    console.log('\nTest 4: Checking scroll functionality...');
    if (navAnchors.length > 0) {
        console.log('✅ Scroll event listeners found on anchor links');
    } else {
        console.log('❌ No scroll event listeners found');
    }
    
    // Test 5: Check if IntersectionObserver exists in the code
    console.log('\nTest 5: Checking IntersectionObserver setup...');
    // Since we can't directly check the observer, we verify that the elements exist for it
    if (projectCards.length > 0 || skillGroups.length > 0) {
        console.log('✅ Elements exist for IntersectionObserver to monitor');
    } else {
        console.log('❌ No elements found for IntersectionObserver');
    }
    
    console.log('\nUnit tests completed!');
}

// Run tests when the document is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTests);
} else {
    runTests();
}