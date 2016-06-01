#include <stdio.h>
#include <unistd.h>
#include <node.h>
#include <uv.h>

#include "CPUInfo.hpp"
#include <vector>

namespace CPUUsage {
    using v8::FunctionCallbackInfo;
    using v8::Isolate;
    using v8::Local;
    using v8::Object;
    using v8::String;
    using v8::Value;
    using v8::Array;
    using v8::Number;
    using v8::Handle;
    using v8::Function;
    using v8::Persistent;

    struct Work {
        uv_work_t  request;
        Persistent<Function> callback;

        CPUInfo * cpu;
        char *error;
        int error_code;
    };

    static void WorkAsync(uv_work_t *req) {
        Work *work = static_cast<Work *>(req->data);

        work->cpu = new CPUInfo();
        work->error_code = work->cpu->load();
    }

    static void WorkAsyncComplete(uv_work_t *req,int status) {
        Isolate * isolate = Isolate::GetCurrent();
        v8::HandleScope handleScope(isolate); // Required for Node 4.x

        Work *work = static_cast<Work *>(req->data);
        Handle<Value> argv[2];

        if (work->error_code != 0) {
            Local<Object> error = Object::New(isolate);

            switch (work->error_code) {
                case 1002:
                    error->Set(String::NewFromUtf8(isolate, "msg"), String::NewFromUtf8(isolate, "File proc\\stat does not exist."));
                    break;
                default:
                    error->Set(String::NewFromUtf8(isolate, "msg"), String::NewFromUtf8(isolate, "Failed to scan processor info."));
                    break;
            }

            error->Set(String::NewFromUtf8(isolate, "code"), Number::New(isolate, work->error_code));

            argv[0] = error;
            argv[1] = v8::Null(isolate);
        } else {
            Local<Array> cpus = Array::New(isolate, (int)work->cpu->ticksList.size());

            for (size_t i = 0; i < work->cpu->ticksList.size(); i++) {
                float total = Ticks::getTotal(work->cpu->ticksList[i], work->cpu->prevTicksList[i]);
                float user = Ticks::getUser(work->cpu->ticksList[i], work->cpu->prevTicksList[i]);
                float system = Ticks::getSystem(work->cpu->ticksList[i], work->cpu->prevTicksList[i]);

                Local<Object> result = Object::New(isolate);
                result->Set(String::NewFromUtf8(isolate, "name"), Number::New(isolate, i));
                result->Set(String::NewFromUtf8(isolate, "total"), Number::New(isolate, total));
                result->Set(String::NewFromUtf8(isolate, "user"), Number::New(isolate, user));
                result->Set(String::NewFromUtf8(isolate, "system"), Number::New(isolate, system));

                cpus->Set(i, result);
            }

            delete work->cpu;

            argv[0] = v8::Null(isolate);
            argv[1] = cpus;
        }

        Local<Function>::New(isolate, work->callback)->Call(isolate->GetCurrentContext()->Global(), 2, argv);
        work->callback.Reset();

        delete work;
    }

    void Method(const FunctionCallbackInfo<Value>& args) {
        Isolate* isolate = args.GetIsolate();

        Work * work = new Work();
        work->request.data = work;

        Local<Function> callback = Local<Function>::Cast(args[0]);
        work->callback.Reset(isolate, callback);
        
        uv_queue_work(uv_default_loop(),&work->request,
                      WorkAsync,WorkAsyncComplete);
        
        args.GetReturnValue().Set(Undefined(isolate));
    }
    
    void init(Local<Object> exports) {
        NODE_SET_METHOD(exports, "usage", Method);
    }
    
    NODE_MODULE(cpuaddon, init)
    
}