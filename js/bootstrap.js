// Initial render and global error handling. Loads last.
render();
window.addEventListener("error",event=>{
 console.error("VCT runtime error:",event.error||event.message);
});

document.querySelectorAll("[data-new-challenge]").forEach(btn=>btn.addEventListener("click",e=>{
 e.preventDefault();startNewChallengeFlow();
}));
