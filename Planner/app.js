const DAY_WIDTH = 20;
const DAYS_TOTAL = 666;

const chart = document.getElementById("chart");
const timeline = document.getElementById("timeline");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskNameInput = document.getElementById("taskNameInput");
const tasksList = document.getElementById("tasksList");
const divider = document.getElementById("divider");

const contextMenu = document.getElementById("contextMenu");
const deleteTaskBtn = document.getElementById("deleteTask");
const renameTaskBtn = document.getElementById("renameTask");

let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");

// Ensure all existing tasks have a color property
tasks = tasks.map(task => {
  if (!task.color) {
    task.color = "green"; // Default color for existing tasks
  }
  return task;
});

let contextTaskIndex = null;
let selectedTaskIndex = null;
let isDragging = false;
let isEditing = false;
let editingTaskIndex = null;
let currentColor = "green"; // Default color

/* ---------- Init ---------- */

function initTimeline() {
  for (let i = 1; i <= DAYS_TOTAL; i++) {
    const d = document.createElement("div");
    d.textContent = i;
    timeline.appendChild(d);
  }
}

function save() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

/* ---------- Divider Resizing ---------- */

function setupDivider() {
  let isResizing = false;
  
  divider.addEventListener('mousedown', function(e) {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    if (!isResizing) return;
    
    const ganttContent = document.querySelector('.gantt-content');
    const tasksListEl = document.getElementById('tasksList');
    
    // Calculate new width for the tasks list based on the mouse position relative to the gantt content
    const contentRect = ganttContent.getBoundingClientRect();
    const newWidth = Math.max(150, Math.min(400, e.clientX - contentRect.left));
    
    tasksListEl.style.width = newWidth + 'px';
  });
  
  document.addEventListener('mouseup', function() {
    isResizing = false;
    document.body.style.cursor = '';
  });
}

/* ---------- Selection ---------- */

function selectTask(index) {
  if (tasks.length === 0) {
    selectedTaskIndex = null;
    return;
  }

  if (index < 0) index = tasks.length - 1;
  if (index >= tasks.length) index = 0;

  selectedTaskIndex = index;
  updateSelection();
}

function updateSelection() {
  // Update selection in chart
  document.querySelectorAll('.task').forEach((el, i) => {
    if (i === selectedTaskIndex) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
  
  // Update selection in task list
  document.querySelectorAll('.task-item').forEach((el, i) => {
    if (i === selectedTaskIndex) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
}

/* ---------- Render ---------- */

function render() {
  chart.innerHTML = "";
  tasksList.innerHTML = "";

  tasks.forEach((task, index) => {
    // Add task to the left panel
    const taskItem = document.createElement("div");
    taskItem.className = "task-item";
    taskItem.textContent = task.name;
    taskItem.dataset.index = index;
    
    if (index === selectedTaskIndex) {
      taskItem.classList.add('selected');
    }
    
    taskItem.addEventListener('click', () => {
      selectTask(index);
    });
    
    tasksList.appendChild(taskItem);

    // Add task to the chart
    const el = document.createElement("div");
    el.className = "task";
    
    const taskLabel = document.createElement("span");
    taskLabel.className = "task-label";
    taskLabel.textContent = task.name;
    el.appendChild(taskLabel);

    if (index === selectedTaskIndex) {
      el.classList.add("selected");
    }

    el.style.left = task.start * DAY_WIDTH + "px";
    el.style.top = index * 40 + "px";  // Keep the same positioning logic
    el.style.width = task.duration * DAY_WIDTH + "px";
    el.style.position = "absolute";  // Ensure position is absolute
    el.style.backgroundColor = task.color || "green";  // Apply task color

    enableInteractions(el, index);
    enableContextMenu(el, index);

    chart.appendChild(el);
  });
  
  // Update chart height to accommodate all tasks
  chart.style.height = Math.max(400, tasks.length * 40) + "px";
}

/* ---------- Actions ---------- */

function addTask() {
  const name = taskNameInput.value.trim() || "Task " + (tasks.length + 1);

  tasks.push({
    name,
    start: 1,
    duration: 5,
    color: currentColor
  });

  selectedTaskIndex = tasks.length - 1;

  taskNameInput.value = "";
  taskNameInput.focus();

  save();
  render();
}

/* ---------- Move + Resize ---------- */

function enableInteractions(el, index) {
  // Create resize handle
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "resize-handle";
  el.appendChild(resizeHandle);

  // Resize handle interaction
  resizeHandle.addEventListener("mousedown", e => {
    if (isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    
    // Set cursor for entire document during resize
    document.body.style.cursor = "ew-resize";
    
    const startX = e.clientX;
    const originalDuration = tasks[index].duration;

    function onMove(e) {
      e.preventDefault();
      const dx = e.clientX - startX;
      const delta = Math.round(dx / DAY_WIDTH);

      let d = originalDuration + delta;
      d = Math.max(1, d);
      if (tasks[index].start + d > DAYS_TOTAL)
        d = DAYS_TOTAL - tasks[index].start;
      tasks[index].duration = d;
      el.style.width = d * DAY_WIDTH + "px";
    }

    function stop() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", stop);
      
      // Reset cursor
      document.body.style.cursor = "";
      
      isDragging = false;
      save();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", stop);
  });

  // Move interaction
  el.addEventListener("mousedown", e => {
    if (e.button !== 0 || e.target === resizeHandle || isEditing) return;

    e.preventDefault();
    
    // Select task immediately without re-rendering
    if (selectedTaskIndex !== index) {
      selectedTaskIndex = index;
      updateSelection();
    }

    // Set cursor for entire document during move
    document.body.style.cursor = "grabbing";

    const startMouseX = e.clientX;
    const startLeft = tasks[index].start * DAY_WIDTH;
    isDragging = true;

    function onMove(e) {
      e.preventDefault();
      const dx = e.clientX - startMouseX;
      let newLeft = startLeft + dx;

      // Calculate bounds in pixels
      const minLeft = 0;
      const maxLeft = (DAYS_TOTAL - tasks[index].duration) * DAY_WIDTH;

      // Clamp position
      newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));

      // Update visual position immediately
      el.style.left = newLeft + "px";

      // Update data model with snapped value
      tasks[index].start = Math.round(newLeft / DAY_WIDTH);
    }

    function stop() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", stop);
      
      // Reset cursor
      document.body.style.cursor = "";
      
      // Snap to grid on release
      const snappedStart = Math.round(tasks[index].start);
      tasks[index].start = snappedStart;
      el.style.left = snappedStart * DAY_WIDTH + "px";
      
      isDragging = false;
      save();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", stop);
  });
}

/* ---------- Context Menu ---------- */

function enableContextMenu(el, index) {
  el.addEventListener("contextmenu", e => {
    e.preventDefault();
    if (!isDragging) {
      selectedTaskIndex = index;
      updateSelection();

      contextTaskIndex = index;
      contextMenu.style.left = e.pageX + "px";
      contextMenu.style.top = e.pageY + "px";
      contextMenu.style.display = "block";
    }
  });
}

deleteTaskBtn.addEventListener("click", () => {
  if (contextTaskIndex !== null) {
    tasks.splice(contextTaskIndex, 1);

    if (selectedTaskIndex >= tasks.length)
      selectedTaskIndex = tasks.length - 1;

    contextTaskIndex = null;
    save();
    render();
  }
  hideContextMenu();
});

renameTaskBtn.addEventListener("click", () => {
  if (contextTaskIndex !== null) {
    startInlineRename(contextTaskIndex);
    contextTaskIndex = null;
  }
  hideContextMenu();
});

function startInlineRename(taskIndex) {
  isEditing = true;
  editingTaskIndex = taskIndex;
  
  const taskElement = document.querySelectorAll('.task')[taskIndex];
  const taskLabel = taskElement.querySelector('.task-label');
  const currentName = tasks[taskIndex].name;
  
  // Create input element
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.className = 'task-name-input';
  input.style.cssText = `
    background: transparent;
    border: none;
    color: white;
    font-size: inherit;
    font-family: inherit;
    padding: 0;
    margin: 0;
    width: 100%;
    outline: none;
    cursor: text;
  `;
  
  // Replace label with input
  taskLabel.style.display = 'none';
  taskElement.insertBefore(input, taskLabel);
  
  // Focus and select text
  input.focus();
  input.select();
  
  // Handle input events
  input.addEventListener('keydown', handleRenameKeydown);
  input.addEventListener('blur', finishRename);
  input.addEventListener('input', adjustInputWidth);
  
  // Adjust width initially
  adjustInputWidth.call(input);
}

function handleRenameKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    finishRename.call(this);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    cancelRename.call(this);
  }
  // Allow arrow keys to work within the input
  e.stopPropagation();
}

function finishRename() {
  const input = this;
  const newName = input.value.trim();
  
  if (newName && editingTaskIndex !== null) {
    tasks[editingTaskIndex].name = newName;
    save();
    // Update the task label text immediately
    const taskElement = input.closest('.task');
    const taskLabel = taskElement.querySelector('.task-label');
    taskLabel.textContent = newName;
  }
  
  cleanupRename.call(this);
}

function cancelRename() {
  cleanupRename.call(this);
}

function cleanupRename() {
  const input = this;
  const taskElement = input.closest('.task');
  const taskLabel = taskElement.querySelector('.task-label');
  
  // Remove input and restore label
  input.remove();
  taskLabel.style.display = '';
  
  // Reset editing state
  isEditing = false;
  editingTaskIndex = null;
}

function adjustInputWidth() {
  const input = this;
  // Create a temporary span to measure text width
  const span = document.createElement('span');
  span.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre;
    font-size: inherit;
    font-family: inherit;
    padding: 0;
    margin: 0;
  `;
  span.textContent = input.value || input.placeholder;
  document.body.appendChild(span);
  
  // Set input width based on text width
  input.style.width = (span.offsetWidth + 10) + 'px';
  
  document.body.removeChild(span);
}

function hideContextMenu() {
  contextMenu.style.display = "none";
}

document.addEventListener("click", hideContextMenu);

/* ---------- Keyboard Navigation ---------- */

document.addEventListener("keydown", e => {
  // Don't handle keyboard shortcuts if we're editing a task name or if focus is in add task input
  const activeElement = document.activeElement;
  const isAddTaskInputFocused = activeElement && activeElement.id === 'taskNameInput';
  
  if (isEditing || isAddTaskInputFocused) return;
  
  if (tasks.length === 0 || selectedTaskIndex === null) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectTask(selectedTaskIndex + 1);
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    selectTask(selectedTaskIndex - 1);
  }

  if (e.key === "ArrowRight") {
    e.preventDefault();
    let d = tasks[selectedTaskIndex].duration + 1;
    if (tasks[selectedTaskIndex].start + d <= DAYS_TOTAL) {
      tasks[selectedTaskIndex].duration = d;
      save();
      render();
    }
  }

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    let d = tasks[selectedTaskIndex].duration - 1;
    if (d >= 1) {
      tasks[selectedTaskIndex].duration = d;
      save();
      render();
    }
  }
});

/* ---------- Keyboard ---------- */

taskNameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") addTask();
});

/* ---------- Scroll Synchronization ---------- */

// Get the containers
const timelineContainer = document.querySelector(".timeline-container");
const chartContainer = document.querySelector(".chart-container");

// Sync timeline scroll to chart container
timelineContainer.addEventListener("scroll", () => {
  chartContainer.scrollLeft = timelineContainer.scrollLeft;
});

// Sync chart container scroll to timeline
chartContainer.addEventListener("scroll", () => {
  timelineContainer.scrollLeft = chartContainer.scrollLeft;
});

// Sync vertical scrolling between task list and chart
const tasksListContainer = document.getElementById("tasksList");
chartContainer.addEventListener("scroll", () => {
  tasksListContainer.scrollTop = chartContainer.scrollTop;
});

tasksListContainer.addEventListener("scroll", () => {
  chartContainer.scrollTop = tasksListContainer.scrollTop;
});

/* ---------- Color Picker ---------- */

// Add event listeners to color options
document.querySelectorAll('.color-option').forEach(option => {
  option.addEventListener('click', () => {
    // Remove selected class from all options
    document.querySelectorAll('.color-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    
    // Add selected class to clicked option
    option.classList.add('selected');
    
    // Update current color
    currentColor = option.getAttribute('data-color');
  });
});

/* ---------- Keyboard Navigation for Colors ---------- */

// Handle arrow key navigation for color selection when task name input is focused
taskNameInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    
    // Get all color options
    const colorOptions = Array.from(document.querySelectorAll('.color-option'));
    const currentIndex = colorOptions.findIndex(option => 
      option.classList.contains('selected')
    );
    
    let newIndex;
    if (e.key === 'ArrowRight') {
      newIndex = (currentIndex + 1) % colorOptions.length;
    } else if (e.key === 'ArrowLeft') {
      newIndex = (currentIndex - 1 + colorOptions.length) % colorOptions.length;
    }
    
    // Remove selected class from current option
    colorOptions[currentIndex]?.classList.remove('selected');
    
    // Add selected class to new option
    colorOptions[newIndex]?.classList.add('selected');
    
    // Update current color
    currentColor = colorOptions[newIndex].getAttribute('data-color');
  }
});

/* ---------- Boot ---------- */

setupDivider();
initTimeline();
render();
taskNameInput.focus();
addTaskBtn.addEventListener("click", addTask);