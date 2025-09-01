// public/js/script.js
(function(){
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const socket = window.io ? io() : null;

  function guard(roleNeeded){
    if(!user){ alert('Not logged in'); location.href='index.html'; return false; }
    if(roleNeeded && user.role !== roleNeeded){ alert('Access denied'); location.href='index.html'; return false; }
    return true;
  }
  const $ = (id)=> document.getElementById(id);
  const api = (url, opts={}) => fetch(url, opts).then(r=>r.json());

  /* ---------------- Student Page ---------------- */
  if($('studName')){
    if(!guard('student')) return;
    $('studName').textContent = `— ${user.username} (ID ${user.id}) • Credits: ${user.credits ?? 0}`;

    const allUnis = $('allUniversities');
    const myUnis = $('myUniversities');
    const browseUni = $('browseUniversitySelect');
    const coursesList = $('coursesList');
    const enrolledList = $('enrolledList');
    const submitCourse = $('submitCourse');
    const mySubs = $('mySubmissions');
    const certsList = $('myCertificates');
    const equivTarget = $('equivTargetUniversity');

    async function loadAllUniversities(){
      const d = await api('/universities');
      const unis = d.universities || [];
      allUnis.innerHTML = ''; browseUni.innerHTML=''; equivTarget.innerHTML='';
      unis.forEach(u=>{
        const o1=document.createElement('option'); o1.value=u.id; o1.textContent=u.name; allUnis.appendChild(o1);
        const o2=document.createElement('option'); o2.value=u.id; o2.textContent=u.name; browseUni.appendChild(o2);
        const o3=document.createElement('option'); o3.value=u.id; o3.textContent=u.name; equivTarget.appendChild(o3);
      });
    }
    async function loadMyUniversities(){
      const d = await api(`/student/my-universities?student_id=${user.id}`);
      myUnis.innerHTML='';
      (d.universities||[]).forEach(u=>{
        const li=document.createElement('li'); li.textContent = `${u.name}`;
        myUnis.appendChild(li);
      });
    }
    async function loadCourses(){
  const uid = Number(browseUni.value);
  const pid = Number($('browseProgramSelect')?.value); // 👈 new program select

  if(!uid){ coursesList.innerHTML=''; return; }
const url = pid 
  ? `/courses/by-program?university_id=${uid}&program_id=${pid}`
  : `/courses/by-university?university_id=${uid}`;
const d = await api(url);

 

      coursesList.innerHTML='';
      (d.courses||[]).forEach(c=>{
        const li=document.createElement('li');
        li.innerHTML = `
          <div>
            <div><b>${c.code}</b> — ${c.title} (${c.credit_value} cr)</div>
            ${c.faculty_name? `<div class="muted">Faculty: ${c.faculty_name} (Code: ${c.faculty_code || '---'})</div>`:''}
            ${c.notes_url? `<a href="${c.notes_url}" target="_blank">Download Notes</a>`:''}
          </div>
          <button class="primary" data-id="${c.id}">Enroll</button>
        `;
        li.querySelector('button').onclick = ()=> enroll(c.id);
        coursesList.appendChild(li);
      });
      // Fill submission course selector as well
      submitCourse.innerHTML='';
      (d.courses||[]).forEach(c=>{
        const o=document.createElement('option'); o.value=c.id; o.textContent=`${c.code} — ${c.title}`; submitCourse.appendChild(o);
      });
    }
    async function enroll(course_id){
      const r = await api('/student/enroll',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ student_id:user.id, course_id })});
      if(!r.ok){ alert(r.error||'Enroll failed'); return; }
      alert('Enrolled!');
      loadEnrollments();
    }
    async function loadEnrollments(){
      const d = await api(`/student/my-enrollments?student_id=${user.id}`);
      enrolledList.innerHTML='';
      (d.enrollments||[]).forEach(e=>{
        const li=document.createElement('li');
        const btn = (e.status==='enrolled') ? `<button class="primary" data-id="${e.enrollment_id}">Request Completion</button>` : `<span class="badge">${e.status}</span>`;
        li.innerHTML = `
          <div>
            <div><b>${e.code}</b> — ${e.title} (${e.credit_value} cr)</div>
            <div class="muted">${e.university_name}</div>
          </div>
          <div>${btn}</div>
        `;
        if(e.status==='enrolled'){
          li.querySelector('button').onclick = async ()=>{
            const r = await api('/student/request-completion',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ enrollment_id: e.enrollment_id })});
            if(!r.ok) return alert(r.error||'Failed');
            loadEnrollments();
          };
        }
        enrolledList.appendChild(li);
      });
    }
    async function uploadSubmission(){
      const cid = Number(submitCourse.value);
      const file = $('submitFile').files[0];
      if(!cid || !file) return alert('Select course & file');
      const fd = new FormData();
      fd.append('student_id', user.id);
      fd.append('course_id', cid);
      fd.append('file', file);
      const r = await fetch('/student/submission', { method:'POST', body: fd });
      const d = await r.json();
      if(!d.ok) return alert(d.error||'Upload failed');
      alert('Uploaded!');
      loadMySubmissions();
    }
    async function loadMySubmissions(){
      const d = await api(`/student/submissions?student_id=${user.id}`);
      mySubs.innerHTML='';
      (d.submissions||[]).forEach(s=>{
        const li=document.createElement('li');
        li.innerHTML = `
          <div>
            <div>${s.code} — ${s.title}</div>
            <a href="${s.url}" target="_blank">${s.original}</a>
            <div class="muted">Status: ${s.status}${s.marks!=null? ', Marks: '+s.marks:''}</div>
          </div>
        `;
        mySubs.appendChild(li);
      });
      if((d.submissions||[]).length===0){
        mySubs.innerHTML = `<li><span class="muted">No submissions yet.</span></li>`;
      }
    }
    async function loadCertificates(){
      const d = await api(`/student/certificates?student_id=${user.id}`);
      certsList.innerHTML='';
      (d.certificates||[]).forEach(c=>{
        const li=document.createElement('li');
        li.innerHTML=`
          <div>
            <div><b>${c.serial}</b> — ${c.type}</div>
            <div class="muted">Issued: ${new Date(c.issued_at).toLocaleString()}</div>
            <div>Status: <span class="badge ${c.status==='validated'?'approved':'pending'}">${c.status}</span></div>
          </div>
          <a class="secondary" href="/verify/${c.serial}" target="_blank">Open</a>
        `;
        certsList.appendChild(li);
      });
    }
    async function requestEquivalency(){
      const source_serial = $('equivSourceSerial').value.trim();
      const target_university_id = Number(equivTarget.value);
      if(!source_serial || !target_university_id) return alert('Enter serial and target university');
      const r = await api('/student/equivalency', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ student_id:user.id, source_serial, target_university_id })});
      if(!r.ok) return alert(r.error||'Failed');
      alert('Equivalency issued (pending validation). Serial: '+r.serial);
      loadCertificates();
    }

    $('joinUniversityBtn').onclick = async ()=>{
      const university_id = Number(allUnis.value);
      if(!university_id) return;
      const r = await api('/student/join-university',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ student_id:user.id, university_id })});
      if(!r.ok) return alert(r.error||'Join failed');
      loadMyUniversities();
    };
    $('studentRefreshBtn').onclick = ()=>{ loadAllUniversities(); loadMyUniversities(); };
    $('loadCoursesBtn').onclick = loadCourses;
    $('submitBtn').onclick = uploadSubmission;
    $('requestEquivalencyBtn').onclick = requestEquivalency;

    // Chatbot (client-side quick hints)
    $('chatBtn').onclick = async ()=>{
      const q = $('chatInput').value;
      const tips = "Try: login, course, enroll, credits, certificate, equivalency, employer.";
      let reply = "";
      const lq = (q||"").toLowerCase();
      if(lq.includes('hello')||lq.includes('hi')) reply = "Hello! 👋 Need help with Courses, Credits, Certificates or Equivalency?";
      else if(lq.includes('login')) reply = "Login with your username & password on the homepage.";
      else if(lq.includes('course')) reply = "Browse a university, then Enroll. Request completion after finishing.";
      else if(lq.includes('credit')) reply = "Credits add automatically when faculty marks your enrollment as completed.";
      else if(lq.includes('certificate')) reply = "Certificates are issued automatically when your enrollment is completed.";
      else if(lq.includes('equivalency')) reply = "Enter a base certificate serial and select a target university. Accreditation can validate to blockchain.";
      else if(lq.includes('employer')||lq.includes('validate')) reply = "Employers open /verify/:serial or use the Employer page.";
      else reply = "I didn’t get that. " + tips;
      $('chatReply').textContent = reply;
    };

    loadAllUniversities();
    loadMyUniversities();
    loadCourses();
    loadEnrollments();
    loadMySubmissions();
    loadCertificates();

    if(socket){
      socket.on('courseAdded', loadCourses);
      socket.on('studentEnrolled', loadEnrollments);
      socket.on('completionRequested', loadEnrollments);
      socket.on('enrollmentCompleted', (p)=>{ loadEnrollments(); loadCertificates(); });
      socket.on('submissionReviewed', loadMySubmissions);
      socket.on('submissionUploaded', loadMySubmissions);
    }
  }

  /* ---------------- Admin Page ---------------- */
  if ($('adminName')) {
  if (!guard('admin')) return;
  $('adminName').textContent = `— ${user.username} (ID ${user.id})`;

  const uniName = $('uniName');
  const uniList = $('universitiesList');
  const uniSelect = $('courseUniversity');
  const programUniSelect = $('programUniversity');
const programName = $('programName');
const programList = $('programsList');

const feeUniSelect = $('feeUniversity');
const feeProgramSelect = $('feeProgram');  // ✅ new
const feeTypeInput = $('feeType');         // ✅ new
const feeAmount = $('feeAmount');
const feeList = $('feesList');


  const coursesList = $('coursesList');
  const enrollmentsList = $('adminEnrollments');
  const subsList = $('adminSubmissions');
  const certList = $('adminCertificates');


  // Add University
 // Add University
$('addUniversityBtn').onclick = async () => {
  const name = uniName.value.trim();
  if (!name) return alert('Enter university name!');
  const r = await api('/admin/university', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_id: user.id, name })
  });
  if (!r.ok) return alert(r.error || 'Failed');
  uniName.value = '';
  alert('University added.');
  loadAdminUniversities(); // refresh list
};
// Add Program
// === Add Program ===
// === Add Program === FIXED
document.getElementById("addProgramBtn").onclick = async () => {
  const uniId = document.getElementById("programUniversity").value;
  const name = document.getElementById("programName").value;

  if (!uniId || !name) {
    alert("Please select a university and enter a program name.");
    return;
  }

  try {
    const res = await api('/programs/add', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ university_id: uniId, name }) 
    });
    
    if (res.ok) {
      alert("✅ Program added successfully!");
      document.getElementById("programName").value = ''; // Clear input
      loadPrograms(uniId); // Refresh list
    } else {
      alert("❌ Failed to add program: " + (res.error || "Unknown error"));
    }
  } catch (error) {
    console.error('Add program error:', error);
    alert("❌ Network error adding program");
  }
};
// Add Fee
// Add Fee - FIXED
$('addFeeBtn').onclick = async () => {
  const university_id = Number(feeUniSelect.value);
  const program_id = Number(feeProgramSelect.value);
  const type = feeTypeInput.value.trim();
  const amount = Number(feeAmount.value);

  if (!university_id || !program_id || !type || !amount) return alert('Fill all fields!');

  try {
    const r = await api('/admin/fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: user.id, university_id, program_id, type, amount })
    });
    
    if (!r.ok) {
      alert(r.error || 'Failed to add fee');
      return;
    }
    
    feeAmount.value = '';
    feeTypeInput.value = '';
    alert('Fee added successfully!');
    loadFees(university_id);
  } catch (error) {
    console.error('Add fee error:', error);
    alert('Network error adding fee');
  }
};

async function loadPrograms(university_id) {
  try {
    const d = await api(`/programs/by-university?university_id=${university_id}`);
    programList.innerHTML = '';
    $('courseProgram').innerHTML = '';   // reset select
    feeProgramSelect.innerHTML = '';     // reset select

    (d.programs || []).forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.id}: ${p.name}`;
      programList.appendChild(li);

      // also add to selects
      const opt1 = document.createElement('option');
      opt1.value = p.id; 
      opt1.textContent = p.name;
      $('courseProgram').appendChild(opt1);

      const opt2 = opt1.cloneNode(true);
      feeProgramSelect.appendChild(opt2);
    });
  } catch (error) {
    console.error('Error loading programs:', error);
    programList.innerHTML = '<li class="muted">Error loading programs</li>';
  }
}
async function loadFees(university_id) {
  try {
    const d = await api(`/fees/by-university?university_id=${university_id}`);
    feeList.innerHTML = '';
    
    if (d.fees && d.fees.length > 0) {
      d.fees.forEach(f => {
        const li = document.createElement('li');
        li.textContent = `Fee #${f.id} — ${f.type} • $${f.amount} (Program: ${f.program_name || f.program_id})`;
        feeList.appendChild(li);
      });
    } else {
      feeList.innerHTML = '<li class="muted">No fees found for this university</li>';
    }
  } catch (error) {
    console.error('Error loading fees:', error);
    feeList.innerHTML = '<li class="muted">Error loading fees</li>';
  }
}

// Load Admin Universities
async function loadAdminUniversities() {
  const d = await api(`/admin/universities?admin_id=${user.id}`);
  

  uniList.innerHTML = '';
  uniSelect.innerHTML = '';

  (d.universities || []).forEach(u => {
    const li = document.createElement('li');
    li.innerHTML = `<div>#${u.id} — ${u.name}</div>`;
    uniList.appendChild(li);

    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.name;
    uniSelect.appendChild(opt);
programUniSelect.appendChild(opt.cloneNode(true));
feeUniSelect.appendChild(opt.cloneNode(true));

  });

  if ((d.universities || []).length > 0) {
  const firstUniId = uniSelect.value;
  loadCourses(firstUniId);
  loadPrograms(firstUniId);   // 👈 add
  loadFees(firstUniId);       // 👈 add
} else {
  coursesList.innerHTML = '<li><span class="muted">Create a university to add courses.</span></li>';
}

  loadEnrollments();
  loadSubmissions();
  loadCertificates();
}

feeUniSelect.onchange = () => {
  loadPrograms(feeUniSelect.value); // fill feeProgram select
  loadFees(feeUniSelect.value);
};

uniSelect.onchange = () => {
  loadPrograms(uniSelect.value);    // fill courseProgram select
  loadCourses(uniSelect.value);
};
$('courseProgram').onchange = () => loadCourses(uniSelect.value);




  // Add Course
  $('addCourseBtn').onclick = async () => {
    const code = $('courseCode').value.trim();
    const title = $('courseTitle').value.trim();
    const credit_value = Number($('courseCredits').value);
    const university_id = Number(uniSelect.value);
    const program_id = Number($('courseProgram').value) || null;
    const faculty_id = Number($('courseFacultyId').value) || '';
    const file = $('courseNotes').files[0];

    if (!code || !title || !credit_value || !university_id) return alert('Fill all fields!');


    const fd = new FormData();
    fd.append('admin_id', String(user.id));
    fd.append('university_id', String(university_id));
    fd.append('code', code);
    fd.append('title', title);
    fd.append('credit_value', String(credit_value));
    if (faculty_id) fd.append('faculty_id', String(faculty_id));
    if (program_id) fd.append('program_id', String(program_id));
    if (file) fd.append('notes', file);

    const r = await fetch('/admin/course', { method: 'POST', body: fd });
    const d = await r.json();
    if (!d.ok) return alert(d.error || 'Failed');
    alert('Course added.');
    loadCourses(university_id);
  };

  // Load Courses
async function loadCourses(university_id) {
  const pid = Number($('courseProgram')?.value) || null;
  const url = pid 
    ? `/courses/by-program?university_id=${university_id}&program_id=${pid}`
    : `/courses/by-university?university_id=${university_id}`;

  const d = await api(url);

    coursesList.innerHTML = '';

    if (!d.ok) {
      coursesList.innerHTML = `<li><span class="muted">Error: ${d.error || 'Failed to load courses'}</span></li>`;
      return;
    }

    (d.courses || []).forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <div><b>${c.code}</b> — ${c.title} (${c.credit_value} cr)</div>
          <div class="muted">Faculty: ${c.faculty_name || '—'}</div>
          ${c.notes_url ? `<a href="${c.notes_url}" target="_blank">Notes</a>` : ''}
        </div>`;
      coursesList.appendChild(li);
    });

    if ((d.courses || []).length === 0) {
      coursesList.innerHTML = '<li><span class="muted">No courses yet for this university.</span></li>';
    }
  }

  // 🚀 Load when page opens


    async function loadEnrollments(){
      const d = await api(`/admin/enrollments?admin_id=${user.id}`);
      enrollmentsList.innerHTML='';
      (d.enrollments||[]).forEach(r=>{
        const li=document.createElement('li');
        li.innerHTML = `
          <div>
            <div><b>${r.student_name}</b> — ${r.code} ${r.title} (${r.credit_value} cr)</div>
            <div class="muted">${r.university_name} • Status: ${r.status}</div>
          </div>
        `;
        enrollmentsList.appendChild(li);
      });
      if((d.enrollments||[]).length===0){
        enrollmentsList.innerHTML = '<li><span class="muted">No enrollments yet.</span></li>';
      }
    }

    async function loadSubmissions(){
      const d = await api(`/admin/submissions?admin_id=${user.id}`);
      subsList.innerHTML='';
      (d.submissions||[]).forEach(s=>{
        const li=document.createElement('li');
        li.innerHTML=`
          <div>
            <div><b>${s.student_name}</b> — ${s.code} ${s.title}</div>
            <a href="${s.url}" target="_blank">${s.original}</a>
            <div class="muted">${s.university_name} • Status: ${s.status}${s.marks!=null? ', Marks: '+s.marks:''}</div>
          </div>
        `;
        subsList.appendChild(li);
      });
      if((d.submissions||[]).length===0){
        subsList.innerHTML = '<li><span class="muted">No submissions yet.</span></li>';
      }
    }

    async function loadCertificates(){
      const d = await api(`/admin/certificates?admin_id=${user.id}`);
      certList.innerHTML='';
      (d.certificates||[]).forEach(c=>{
        const li=document.createElement('li');
        li.innerHTML=`
          <div>
            <div><b>${c.serial}</b> — ${c.type}</div>
            <div class="muted">${c.source_university||'-'}</div>
            <div>Status: <span class="badge ${c.status==='validated'?'approved':'pending'}">${c.status}</span></div>
          </div>
          <a class="secondary" href="/verify/${c.serial}" target="_blank">Open</a>
        `;
        certList.appendChild(li);
      });
      if((d.certificates||[]).length===0){
        certList.innerHTML = '<li><span class="muted">No certificates yet.</span></li>';
      }
    }

    if(socket){
      socket.on('universityAdded', loadAdminUniversities);
      socket.on('universityUpdated', loadAdminUniversities);
      socket.on('courseAdded', loadAdminUniversities);
      socket.on('studentEnrolled', loadEnrollments);
      socket.on('completionRequested', loadEnrollments);
      socket.on('enrollmentCompleted', ()=>{ loadEnrollments(); loadCertificates(); });
      socket.on('submissionReviewed', loadSubmissions);
      socket.on('submissionUploaded', loadSubmissions);
    }
    loadAdminUniversities();
  }

  /* ---------------- Faculty Page ---------------- */
  if($('facName')){
    if(!guard('faculty')) return;
    $('facName').textContent = `— ${user.username} (ID ${user.id}, Code ${user.faculty_code || '-'})`;


    const coursesBox = $('facCourses');
    const enrollBox = $('facEnrollments');
    const subsBox = $('facSubmissions');

    async function loadMyCourses(){
      const d = await api(`/faculty/my-courses?faculty_id=${user.id}`);
      coursesBox.innerHTML='';
      (d.courses||[]).forEach(c=>{
        const li=document.createElement('li');
        li.innerHTML = `
          <div>
            <div><b>${c.code}</b> — ${c.title} (${c.credit_value} cr)</div>
            <div class="muted">${c.university_name}</div>
          </div>
        `;
        coursesBox.appendChild(li);
      });
      if((d.courses||[]).length===0){
        coursesBox.innerHTML = '<li><span class="muted">You have no assigned courses yet.</span></li>';
      }
    }

    async function loadEnrollments(){
      const d = await api(`/faculty/enrollments?faculty_id=${user.id}`);
      enrollBox.innerHTML='';
      (d.enrollments||[]).forEach(e=>{
        const li=document.createElement('li');
        const btn = (e.status==='completion_requested') ? `<button class="primary" data-id="${e.enrollment_id}">Mark Completed</button>` : `<span class="badge">${e.status}</span>`;
        li.innerHTML = `
          <div>
            <div><b>${e.student_name}</b> — ${e.code} ${e.title} (${e.credit_value} cr)</div>
            <div class="muted">${e.university_name} • Requested: ${new Date(e.requested_at).toLocaleString()}</div>
          </div>
          <div class="row" style="max-width:260px">
            ${btn}
            <input placeholder="Marks" type="number" id="m_${e.enrollment_id}" />
          </div>
        `;
        if(e.status==='completion_requested'){
          li.querySelector('button').onclick = async ()=>{
            const marks = Number($(`m_${e.enrollment_id}`).value) || null;
            const r = await api('/faculty/complete-enrollment', { method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ faculty_id:user.id, enrollment_id: e.enrollment_id, marks })});
            if(!r.ok) return alert(r.error||'Failed');
            alert('Enrollment completed. Certificate: '+r.certificate_serial);
            loadEnrollments();
          };
        }
        enrollBox.appendChild(li);
      });
      if((d.enrollments||[]).length===0){
        enrollBox.innerHTML = '<li><span class="muted">No enrollments yet.</span></li>';
      }
    }

    async function loadSubmissions(){
      const d = await api(`/faculty/submissions?faculty_id=${user.id}`);
      subsBox.innerHTML='';
      (d.submissions||[]).forEach(s=>{
        const li=document.createElement('li');
        li.innerHTML = `
          <div>
            <div><b>${s.student_name}</b> — ${s.code} ${s.course_title}</div>
            <a href="${s.url}" target="_blank">${s.original}</a>
            <div class="muted">Status: ${s.status}${s.marks!=null? ', Marks: '+s.marks:''}</div>
          </div>
          <div class="row" style="max-width:320px">
            <input placeholder="Marks" type="number" id="sm_${s.id}" />
            <button class="secondary">Review</button>
          </div>
        `;
        li.querySelector('button').onclick = async ()=>{
          const marks = Number($(`sm_${s.id}`).value) || null;
          const r = await api('/faculty/review-submission',{ method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ faculty_id:user.id, submission_id:s.id, marks }) });
          if(!r.ok) return alert(r.error||'Failed');
          loadSubmissions();
        };
        subsBox.appendChild(li);
      });
      if(d.submissions.length===0){
        subsBox.innerHTML = '<li><span class="muted">No submissions yet.</span></li>';
      }
    }

    if(socket){
      socket.on('submissionUploaded', loadSubmissions);
      socket.on('submissionReviewed', loadSubmissions);
      socket.on('completionRequested', loadEnrollments);
      socket.on('enrollmentCompleted', ()=>{ loadEnrollments(); });
    }

    loadMyCourses();
    loadEnrollments();
    loadSubmissions();
  }
})();
