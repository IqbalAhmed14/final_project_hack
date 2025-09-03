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
    $('studName').textContent = `— ${user.username} (ID ${user.id}) • Credits: ${user.credits ?? 0} • CGPA: ${user.cgpa ?? 0.0}`;

        const allUnis = $('allUniversities');
    const myUnis = $('myUniversities');
    const browseUni = $('browseUniversitySelect');
    const coursesList = $('coursesList');
    const enrolledList = $('enrolledList');
    const submitCourse = $('submitCourse');
    const mySubs = $('mySubmissions');
    const certsList = $('myCertificates');
    const equivTarget = $('equivTargetUniversity');
    // =======================
// ATTENDANCE VARIABLES (Student)
// =======================
const attendanceCourseSelect = $('attendanceCourseSelect');
const attendanceSummary = $('attendanceSummary');
const attendanceList = $('attendanceList');
// =======================
// FEE MANAGEMENT VARIABLES
// =======================
const feeType = $('feeType');
const feeAmount = $('feeAmount');
const academicYear = $('academicYear');
const feeStatus = $('feeStatus');
const feeReceipt = $('feeReceipt');
const paymentHistory = $('paymentHistory');
    // =======================
    // ADMISSIONS VARIABLES
    // =======================
    const admissionUniversity = $('admissionUniversity');
    const admissionProgram = $('admissionProgram');
    const admissionFullName = $('admissionFullName');
    const admissionEmail = $('admissionEmail');
    const admissionPhone = $('admissionPhone');
    const admissionDocuments = $('admissionDocuments');
    const applyAdmissionBtn = $('applyAdmissionBtn');
    const admissionStatus = $('admissionStatus');

       async function loadAllUniversities(){
      const d = await api('/universities');
      const unis = d.universities || [];
      allUnis.innerHTML = ''; browseUni.innerHTML=''; equivTarget.innerHTML='';
      unis.forEach(u=>{
        const o1=document.createElement('option'); o1.value=u.id; o1.textContent=u.name; allUnis.appendChild(o1);
        const o2=document.createElement('option'); o2.value=u.id; o2.textContent=u.name; browseUni.appendChild(o2);
        const o3=document.createElement('option'); o3.value=u.id; o3.textContent=u.name; equivTarget.appendChild(o3);
        
        // Also add to admission university dropdown
        const o4=document.createElement('option'); o4.value=u.id; o4.textContent=u.name; admissionUniversity.appendChild(o4);
      });
    }

    // =======================
    // ADMISSIONS FUNCTIONS
    // =======================
    
    // Load programs for selected university
    async function loadAdmissionPrograms() {
      const university_id = Number(admissionUniversity.value);
      if (!university_id) {
        admissionProgram.innerHTML = '';
        return;
      }
      
      try {
        const d = await api(`/programs/by-university?university_id=${university_id}`);
        admissionProgram.innerHTML = '';
        
        (d.programs || []).forEach(p => {
          const option = document.createElement('option');
          option.value = p.id;
          option.textContent = p.name;
          admissionProgram.appendChild(option);
        });
      } catch (error) {
        console.error('Error loading admission programs:', error);
        admissionProgram.innerHTML = '<option value="">Error loading programs</option>';
      }
    }

    // Handle admission application
    async function applyForAdmission() {
      const university_id = Number(admissionUniversity.value);
      const program_id = Number(admissionProgram.value);
      const full_name = admissionFullName.value.trim();
      const email = admissionEmail.value.trim();
      const phone = admissionPhone.value.trim();
      const documents = admissionDocuments.files[0];

      if (!university_id || !program_id || !full_name || !email || !phone) {
        admissionStatus.textContent = 'Please fill all required fields';
        admissionStatus.style.color = '#ff6b6b';
        return;
      }

      admissionStatus.textContent = 'Submitting application...';
      admissionStatus.style.color = '#51cf66';

      try {
        const formData = new FormData();
        formData.append('student_id', user.id);
        formData.append('university_id', university_id);
        formData.append('program_id', program_id);
        formData.append('full_name', full_name);
        formData.append('email', email);
        formData.append('phone', phone);
        if (documents) {
          formData.append('documents', documents);
        }

        const response = await fetch('/admissions/apply', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.ok) {
          admissionStatus.textContent = 'Application submitted successfully!';
          admissionStatus.style.color = '#51cf66';
          
          // Clear form
          admissionFullName.value = '';
          admissionEmail.value = '';
          admissionPhone.value = '';
          admissionDocuments.value = '';
        } else {
          admissionStatus.textContent = 'Error: ' + (data.error || 'Application failed');
          admissionStatus.style.color = '#ff6b6b';
        }
      } catch (error) {
        console.error('Admission application error:', error);
        admissionStatus.textContent = 'Network error. Please try again.';
        admissionStatus.style.color = '#ff6b6b';
      }
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
  if(!uid){ coursesList.innerHTML=''; return; }
  
  // ✅ FIXED: Use correct endpoint
  const d = await api(`/courses/by-university?university_id=${uid}`);

 

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
    async function payFee() {
    const type = feeType.value;
    const amount = Number(feeAmount.value);
    const year = academicYear.value.trim();

    if (!type || !amount || !year) {
        feeStatus.textContent = 'Please fill all fields';
        feeStatus.style.color = '#ff6b6b';
        return;
    }

    feeStatus.textContent = 'Processing payment...';
    feeStatus.style.color = '#51cf66';

    try {
        const response = await api('/fees/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: user.id,
                fee_type: type,
                amount: amount,
                academic_year: year
            })
        });

        if (response.ok) {
            feeStatus.textContent = 'Payment successful!';
            feeStatus.style.color = '#51cf66';
            
            // Show receipt
            feeReceipt.innerHTML = `
                <div style="border:1px solid #ccc; padding:15px; border-radius:8px; margin-top:10px">
                    <h4>Payment Receipt</h4>
                    <p><strong>Receipt No:</strong> ${response.receipt_number}</p>
                    <p><strong>Student:</strong> ${response.student_name}</p>
                    <p><strong>Fee Type:</strong> ${type}</p>
                    <p><strong>Amount:</strong> ₹${amount}</p>
                    <p><strong>Academic Year:</strong> ${year}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                </div>
            `;

            // Clear form
            feeAmount.value = '';
            academicYear.value = '';
            
            // Reload payment history
            loadPaymentHistory();
        } else {
            feeStatus.textContent = 'Error: ' + (response.error || 'Payment failed');
            feeStatus.style.color = '#ff6b6b';
        }
    } catch (error) {
        console.error('Payment error:', error);
        feeStatus.textContent = 'Network error. Please try again.';
        feeStatus.style.color = '#ff6b6b';
    }
}
$('payFeeBtn').onclick = payFee;
async function loadPaymentHistory() {
    try {
        const response = await api(`/fees/student/${user.id}`);
        paymentHistory.innerHTML = '';
        
        if (response.ok && response.payments.length > 0) {
            response.payments.forEach(payment => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div>
                        <div><strong>${payment.fee_type}</strong> - ₹${payment.amount}</div>
                        <div class="muted">Receipt: ${payment.receipt_number}</div>
                        <div class="muted">${payment.academic_year} • ${new Date(payment.payment_date).toLocaleDateString()}</div>
                    </div>
                `;
                paymentHistory.appendChild(li);
            });
        } else {
            paymentHistory.innerHTML = '<li class="muted">No payment history found</li>';
        }
    } catch (error) {
        console.error('Error loading payment history:', error);
    }
}
// =======================
// ATTENDANCE FUNCTIONS (Student)
// =======================
async function loadAttendanceCourses() {
    const d = await api(`/student/my-enrollments?student_id=${user.id}`);
    attendanceCourseSelect.innerHTML = '<option value="">Select enrolled course</option>';
    
    (d.enrollments || []).forEach(e => {
        const option = document.createElement('option');
        option.value = e.enrollment_id;
        option.textContent = `${e.code} - ${e.title}`;
        attendanceCourseSelect.appendChild(option);
    });
}

async function loadAttendance() {
    const enrollment_id = attendanceCourseSelect.value;
    if (!enrollment_id) return;
    
    const response = await api(`/student/attendance?enrollment_id=${enrollment_id}`);
    
    if (response.ok) {
        // Update summary
        attendanceSummary.innerHTML = `
            <div style="display:flex; gap:20px; margin:10px 0">
                <div><strong>Total:</strong> ${response.total} classes</div>
                <div><strong>Present:</strong> ${response.present}</div>
                <div><strong>Percentage:</strong> ${response.percentage}%</div>
            </div>
        `;
        
        // Update list
        attendanceList.innerHTML = '';
        response.attendance.forEach(a => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>${new Date(a.date).toLocaleDateString()} - 
                     <span class="${a.status === 'present' ? 'success' : 'error'}">${a.status.toUpperCase()}</span>
                </div>
            `;
            attendanceList.appendChild(li);
        });
    }
}

// Add event listener
attendanceCourseSelect.onchange = loadAttendance;

    // =======================
// FEE MANAGEMENT FUNCTIONS
// =======================


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
loadPaymentHistory();
loadAttendanceCourses(); 
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
const feeProgramSelect = $('feeProgram');  // ✅ ADD THIS LINE
const feeTypeInput = $('feeType');         // ✅ ADD THIS LINE  
const feeAmount = $('feeAmount');
const feeList = $('feesList');


  const coursesList = $('coursesList');
  const enrollmentsList = $('adminEnrollments');
  const subsList = $('adminSubmissions');
  const certList = $('adminCertificates');
  // =======================
// ADMISSIONS & HOSTEL VARIABLES
// =======================
const admissionsList = $('adminAdmissionsList');
const hostelUniSelect = $('hostelUniversity');
const hostelsList = $('hostelsList');
const allocationsList = $('hostelAllocationsList');


  // Add University
 // Add University
if ($('addUniversityBtn')) {
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
    loadAdminUniversities();
  };
}

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
// Add Course
if ($('addCourseBtn')) {
  $('addCourseBtn').onclick = async () => {
    const code = $('courseCode').value.trim();
    const title = $('courseTitle').value.trim();
    const credit_value = Number($('courseCredits').value);
    const university_id = Number(uniSelect.value);
    const program_id = Number($('courseProgram').value) || null;
    const faculty_id = Number($('courseFacultyId').value) || null;
    const file = $('courseNotes').files[0];

    // DEBUG: Check what values are being captured
    console.log('Course Form Values:', {
      code, title, credit_value, university_id, program_id, faculty_id, file
    });

    // ✅ Frontend validation
    if (!code || !title || !credit_value || !university_id) {
      console.log('Validation Failed - Missing fields detected');
      return alert('Please fill all required fields: Code, Title, Credits, and University!');
    }

    try {
      const fd = new FormData();
      fd.append('admin_id', String(user.id));   // ✅ required
      fd.append('university_id', String(university_id));
      fd.append('code', code);
      fd.append('title', title);
      fd.append('credit_value', String(credit_value));

      // ✅ Always send program_id (even if blank)
      if (program_id) {
        fd.append('program_id', String(program_id));
      } else {
        fd.append('program_id', '');
      }

      if (faculty_id) fd.append('faculty_id', String(faculty_id));
      if (file) fd.append('notes', file);

      const r = await fetch('/admin/course', { method: 'POST', body: fd });
      const d = await r.json();

      if (!d.ok) {
        return alert('Error: ' + (d.error || 'Failed to add course'));
      }

      alert('✅ Course added successfully!');

      // Clear form fields
      $('courseCode').value = '';
      $('courseTitle').value = '';
      $('courseCredits').value = '';
      $('courseFacultyId').value = '';
      $('courseNotes').value = '';

      loadCourses(university_id);
    } catch (error) {
      console.error('Add course error:', error);
      alert('Network error adding course. Please try again.');
    }
  };
}

// Add Fee
// Add Fee - FIXED
// Replace the existing addFeeBtn onclick handler with this corrected version
$('addFeeBtn').onclick = async () => {
  const university_id = Number(feeUniSelect.value);
  const program_id = Number(feeProgramSelect.value);
  const type = feeTypeInput.value.trim();
  const amount = Number(feeAmount.value);

    console.log('Fee Form Values:', {
    university_id, program_id, type, amount, admin_id: user.id // ← Make sure this is included
  });

  if (!university_id || !program_id || !type || !amount) {
    console.log('Fee Validation Failed - Missing fields');
    return alert('Please select University, Program, and enter Fee Type and Amount!');
  }

  try {
    const r = await api('/admin/fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        admin_id: user.id,  // ← THIS IS THE CRITICAL FIX
        university_id, 
        program_id, 
        type, 
        amount 
      })
    });
    
    if (!r.ok) {
      return alert('Error: ' + (r.error || 'Failed to add fee'));
    }
    
    alert('✅ Fee added successfully!');
    
    // Clear form fields
    feeAmount.value = '';
    feeTypeInput.value = '';
    
    loadFees(university_id);
  } catch (error) {
    console.error('Add fee error:', error);
    alert('Network error adding fee. Please try again.');
  }
};
async function loadPrograms(university_id) {
  try {
    const d = await api(`/programs/by-university?university_id=${university_id}`);
    if (programList) programList.innerHTML = '';
    
    // ✅ FIXED: Check if elements exist before using them
    if ($('courseProgram')) $('courseProgram').innerHTML = '<option value="">Select Program</option>';
    if (feeProgramSelect) feeProgramSelect.innerHTML = '<option value="">Select Program</option>';

    (d.programs || []).forEach(p => {
      if (programList) {
        const li = document.createElement('li');
        li.textContent = `${p.id}: ${p.name}`;
        programList.appendChild(li);
      }

      // Add to course program select (if element exists)
      if ($('courseProgram')) {
        const opt1 = document.createElement('option');
        opt1.value = p.id; 
        opt1.textContent = p.name;
        $('courseProgram').appendChild(opt1);
      }

      // Add to fee program select (if element exists)
      if (feeProgramSelect) {
        const opt2 = document.createElement('option');
        opt2.value = p.id;
        opt2.textContent = p.name;
        feeProgramSelect.appendChild(opt2);
      }
    });
  } catch (error) {
    console.error('Error loading programs:', error);
    if (programList) programList.innerHTML = '<li class="muted">Error loading programs</li>';
  }
}
async function loadCourses(university_id) {
  try {
    const d = await api(`/courses/by-university?university_id=${university_id}`);
    coursesList.innerHTML = '';

    if (!d.ok) {
      coursesList.innerHTML = `<li><span class="muted">Error: ${d.error || 'Failed to load courses'}</span></li>`;
      return;
    }

    (d.courses || []).forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <div><b>${c.code}</b> — ${c.title} (${c.credit_value} credits)</div>
          <div class="muted">Program ID: ${c.program_id || 'Not assigned'} | Faculty: ${c.faculty_name || '—'} | Faculty Code: ${c.faculty_code || '—'}</div>
          ${c.notes_url ? `<a href="${c.notes_url}" target="_blank">📎 Download Notes</a>` : ''}
        </div>`;
      coursesList.appendChild(li);
    });

    if ((d.courses || []).length === 0) {
      coursesList.innerHTML = '<li><span class="muted">No courses found for this university.</span></li>';
    }
  } catch (error) {
    console.error('Error loading courses:', error);
    coursesList.innerHTML = '<li><span class="muted">Error loading courses. Please refresh.</span></li>';
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
// ✅ ADD THESE EVENT LISTENERS (CRITICAL!)
if (feeUniSelect) {
  feeUniSelect.onchange = () => {
    const uniId = feeUniSelect.value;
    if (uniId) {
      loadPrograms(uniId);
      loadFees(uniId);
    }
  };
}

if (uniSelect) {
  uniSelect.onchange = () => {
    const uniId = uniSelect.value;
    if (uniId) {
      loadPrograms(uniId);
      loadCourses(uniId);
    }
  };
}

// Add this if you have a courseProgram dropdown
if ($('courseProgram')) {
  $('courseProgram').onchange = () => {
    loadCourses(uniSelect.value);
  };
}
// =======================
// ADMISSIONS FUNCTIONS
// =======================
async function loadAdmissions() {
  try {
    const d = await api(`/admin/admissions?admin_id=${user.id}`);
    admissionsList.innerHTML = '';
    
    (d.applications || []).forEach(app => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <div><b>${app.full_name}</b> — ${app.program_name} @ ${app.university_name}</div>
          <div class="muted">Email: ${app.email} • Phone: ${app.phone}</div>
          <div>Status: <span class="badge ${app.status}">${app.status}</span></div>
          ${app.documents_url ? `<a href="${app.documents_url}" target="_blank">View Documents</a>` : ''}
        </div>
        <div>
          <button class="primary" onclick="updateAdmissionStatus(${app.id}, 'approved')">Approve</button>
          <button class="secondary" onclick="updateAdmissionStatus(${app.id}, 'rejected')">Reject</button>
        </div>
      `;
      admissionsList.appendChild(li);
    });

    if ((d.applications || []).length === 0) {
      admissionsList.innerHTML = '<li><span class="muted">No admission applications yet.</span></li>';
    }
  } catch (error) {
    console.error('Error loading admissions:', error);
    admissionsList.innerHTML = '<li><span class="muted">Error loading applications</span></li>';
  }
}

async function updateAdmissionStatus(admission_id, status) {
  try {
    const r = await api('/admin/admissions/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: user.id, admission_id, status })
    });
    
    if (r.ok) {
      alert(`Application ${status}`);
      loadAdmissions();
    } else {
      alert('Error: ' + (r.error || 'Update failed'));
    }
  } catch (error) {
    console.error('Update admission error:', error);
    alert('Network error updating status');
  }
}
// =======================
// HOSTEL FUNCTIONS
// =======================
async function loadHostels() {
  const university_id = Number(hostelUniSelect.value);
  if (!university_id) {
    hostelsList.innerHTML = '';
    allocationsList.innerHTML = '';
    return;
  }

  try {
    // Load hostels
    const hostelsData = await api(`/hostels/by-university?university_id=${university_id}`);
    hostelsList.innerHTML = '';
    
    (hostelsData.hostels || []).forEach(h => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <div><b>${h.name}</b></div>
          <div class="muted">Rooms: ${h.occupied_rooms}/${h.total_rooms} • $${h.fees_per_semester}/semester</div>
          ${h.amenities ? `<div>Amenities: ${h.amenities}</div>` : ''}
        </div>
      `;
      hostelsList.appendChild(li);
    });

    // Load allocations
    const allocData = await api(`/hostels/allocations?university_id=${university_id}`);
    allocationsList.innerHTML = '';
    
    (allocData.allocations || []).forEach(a => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <div><b>${a.student_username}</b> — Room ${a.room_number}</div>
          <div class="muted">${a.hostel_name} • ${a.academic_year} - Semester ${a.semester}</div>
          <div>Status: <span class="badge">${a.status}</span></div>
        </div>
      `;
      allocationsList.appendChild(li);
    });

  } catch (error) {
    console.error('Error loading hostels:', error);
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
  hostelUniSelect.appendChild(opt.cloneNode(true)); // Add to hostel dropdown
});

if ((d.universities || []).length > 0) {
  const firstUniId = uniSelect.value;
  if (firstUniId) {
    loadCourses(firstUniId);
    loadPrograms(firstUniId);
    loadFees(firstUniId);
    loadAdmissions();
    loadHostels();
  }
}else {
  coursesList.innerHTML = '<li><span class="muted">Create a university to add courses.</span></li>';
}

  loadEnrollments();
  loadSubmissions();
  loadCertificates();
}




   // Replace this problematic section around line 918:
// $('joinUniversityBtn').onclick = async ()=>{ ... };

// With this safer approach:
if ($('joinUniversityBtn')) {
  $('joinUniversityBtn').onclick = async ()=>{
    const university_id = Number(allUnis.value);
    if(!university_id) return;
    const r = await api('/student/join-university',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ student_id:user.id, university_id })});
    if(!r.ok) return alert(r.error||'Join failed');
    loadMyUniversities();
  };
}
    // =======================
    // ADMISSIONS EVENT LISTENERS
    // =======================
    admissionUniversity.onchange = loadAdmissionPrograms;
    applyAdmissionBtn.onclick = applyForAdmission;

    $('studentRefreshBtn').onclick = ()=>{ loadAllUniversities(); loadMyUniversities(); };
 

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
// =======================
// ATTENDANCE VARIABLES (Faculty)
// =======================
const facultyCourseSelect = $('facultyCourseSelect');
const attendanceMarking = $('attendanceMarking');
const attendanceStudentsList = $('attendanceStudentsList');
const facultyAttendanceSummary = $('facultyAttendanceSummary');
const saveAttendanceBtn = $('saveAttendanceBtn');

let currentAttendanceData = [];
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
    // =======================
// ATTENDANCE FUNCTIONS (Faculty)
// =======================
async function loadFacultyAttendanceCourses() {
    const d = await api(`/faculty/my-courses?faculty_id=${user.id}`);
    facultyCourseSelect.innerHTML = '<option value="">Select your course</option>';
    
    (d.courses || []).forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = `${c.code} - ${c.title}`;
        facultyCourseSelect.appendChild(option);
    });
}

async function loadAttendanceStudents() {
    const course_id = facultyCourseSelect.value;
    if (!course_id) return;
    
    const response = await api(`/faculty/course-attendance?course_id=${course_id}&faculty_id=${user.id}`);
    
    if (response.ok) {
        currentAttendanceData = response.attendance;
        
        // Show marking section
        attendanceMarking.style.display = 'block';
        
        // Create student list with checkboxes
        attendanceStudentsList.innerHTML = '';
        response.attendance.forEach(student => {
            const div = document.createElement('div');
            div.style.margin = '5px 0';
            div.innerHTML = `
                <label>
                    <input type="checkbox" data-enrollment="${student.enrollment_id}" checked>
                    ${student.student_name} (${student.percentage}%)
                </label>
            `;
            attendanceStudentsList.appendChild(div);
        });
        
        // Show summary
        facultyAttendanceSummary.innerHTML = `
            <h4>Attendance Summary</h4>
            ${response.attendance.map(s => 
                `${s.student_name}: ${s.present_count}/${s.total_classes} (${s.percentage}%)`
            ).join('<br>')}
        `;
    }
}

async function saveAttendance() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const checkboxes = attendanceStudentsList.querySelectorAll('input[type="checkbox"]');
    
    for (const checkbox of checkboxes) {
        const enrollment_id = checkbox.dataset.enrollment;
        const status = checkbox.checked ? 'present' : 'absent';
        
        await api('/faculty/mark-attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                faculty_id: user.id,
                enrollment_id: enrollment_id,
                date: today,
                status: status
            })
        });
    }
    
    alert('Attendance saved for today!');
    loadAttendanceStudents(); // Refresh
}

// Add event listeners
facultyCourseSelect.onchange = loadAttendanceStudents;
saveAttendanceBtn.onclick = saveAttendance;

    if(socket){
      socket.on('submissionUploaded', loadSubmissions);
      socket.on('submissionReviewed', loadSubmissions);
      socket.on('completionRequested', loadEnrollments);
      socket.on('enrollmentCompleted', ()=>{ loadEnrollments(); });
    }

    loadMyCourses();
    loadEnrollments();
    loadSubmissions();
    loadFacultyAttendanceCourses();
  }
})();
