// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { anything, deepEqual, instance, mock, when } from 'ts-mockito';
import { IPythonExecutionService, ObservableExecutionResult } from '../../../client/common/process/types';
import { ReadWrite } from '../../../client/common/types';
import { KernelDaemonPool } from '../../../client/datascience/kernel-launcher/kernelDaemonPool';
import { PythonKernelLauncherDaemon } from '../../../client/datascience/kernel-launcher/kernelLauncherDaemon';
import { IPythonKernelDaemon } from '../../../client/datascience/kernel-launcher/types';
import { IJupyterKernelSpec } from '../../../client/datascience/types';
import { PythonInterpreter } from '../../../client/pythonEnvironments/info';
import { createPythonInterpreter } from '../../utils/interpreters';

// tslint:disable: max-func-body-length no-any
suite('Data Science - Kernel Launcher Daemon', () => {
    let launcher: PythonKernelLauncherDaemon;
    let daemonPool: KernelDaemonPool;
    let interpreter: PythonInterpreter;
    let kernelSpec: ReadWrite<IJupyterKernelSpec>;
    let kernelDaemon: IPythonKernelDaemon;
    let observableOutputForDaemon: ObservableExecutionResult<string>;
    setup(() => {
        kernelSpec = {
            argv: ['python', '-m', 'ipkernel_launcher', '-f', 'file.json'],
            display_name: '',
            env: { hello: '1' },
            language: 'python',
            name: '',
            path: ''
        };
        interpreter = createPythonInterpreter();
        daemonPool = mock(KernelDaemonPool);
        observableOutputForDaemon = mock<ObservableExecutionResult<string>>();
        kernelDaemon = mock<IPythonKernelDaemon>();
        // Else ts-mockit doesn't allow us to return an instance of a mock as a return value from an async function.
        (instance(kernelDaemon) as any).then = undefined;
        // Else ts-mockit doesn't allow us to return an instance of a mock as a return value from an async function.
        (instance(observableOutputForDaemon) as any).then = undefined;

        when(daemonPool.get(anything(), anything(), anything())).thenResolve(instance(kernelDaemon));
        when(observableOutputForDaemon.proc).thenResolve({} as any);
        when(
            kernelDaemon.start('ipkernel_launcher', deepEqual(['-f', 'file.json']), deepEqual({ env: kernelSpec.env }))
        ).thenResolve(instance(observableOutputForDaemon));
        launcher = new PythonKernelLauncherDaemon(instance(daemonPool));
    });
    test('Does not support launching kernels if there is no -m in argv', async () => {
        kernelSpec.argv = ['wow'];
        const promise = launcher.launch(undefined, kernelSpec, interpreter);

        await assert.isRejected(promise, /^Unsupported KernelSpec file. args must be/g);
    });
    test('Creates and returns a daemon', async () => {
        const daemonCreationOutput = await launcher.launch(undefined, kernelSpec, interpreter);

        assert.isDefined(daemonCreationOutput);

        if (daemonCreationOutput) {
            assert.equal(daemonCreationOutput.observableOutput, instance(observableOutputForDaemon));
            assert.equal(daemonCreationOutput.daemon, instance(kernelDaemon));
        }
    });
    test('If our daemon pool returns an execution service, then use it and return the daemon as undefined', async () => {
        const executionService = mock<IPythonExecutionService>();
        when(
            executionService.execModuleObservable(
                'ipkernel_launcher',
                deepEqual(['-f', 'file.json']),
                deepEqual({ env: kernelSpec.env })
            )
        ).thenReturn(instance(observableOutputForDaemon));
        // Make sure that it doesn't have a start function. Normally the proxy will pretend to have a start function, which we are checking for non-existance
        when((executionService as any).start).thenReturn(false);
        // Else ts-mockit doesn't allow us to return an instance of a mock as a return value from an async function.
        (instance(executionService) as any).then = undefined;
        when(daemonPool.get(anything(), anything(), anything())).thenResolve(instance(executionService) as any);
        const daemonCreationOutput = await launcher.launch(undefined, kernelSpec, interpreter);

        assert.equal(daemonCreationOutput.observableOutput, instance(observableOutputForDaemon));
        assert.isUndefined(daemonCreationOutput.daemon);
    });
});
